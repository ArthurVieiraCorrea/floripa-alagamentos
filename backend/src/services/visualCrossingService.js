'use strict';
// visualCrossingService.js
// Busca precipitação horária observada (mm) das últimas 24h do Visual Crossing Timeline API
// e persiste em weather_observations. Atualiza forecasts_meta.precip_48h_mm com o total observado real.
//
// D-08: Requer VISUAL_CROSSING_API_KEY — retorna silenciosamente se ausente.
// D-10: Nunca re-throw — erros de rede ou parse são logados; sistema continua com Open-Meteo.
// D-11: UPDATE forecasts_meta executado APÓS o COMMIT da transação de observações.
// D-12: INSERT OR IGNORE — observações históricas são imutáveis.
// Segurança: API key nunca logada; parâmetros SQL sempre preparados.

const { getDb } = require('../config/database');

// Coordenadas de Florianópolis
const LAT = -27.5954;
const LON = -48.5480;

// Timeout de 10s para o fetch
const FETCH_TIMEOUT_MS = 10_000;

// Retry: 3 tentativas com backoff exponencial
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

/**
 * Aguarda N milissegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Constrói a URL do Visual Crossing Timeline API para janela de 24h em UTC-3.
 * A API key é lida de process.env e inserida na URL — nunca logada.
 * @returns {string}
 */
function buildUrl() {
  const KEY = process.env.VISUAL_CROSSING_API_KEY;
  const now = new Date();

  // Dia-calendário hoje em UTC-3 (Santa Catarina — sem DST desde Decreto 9.242/2019)
  const date2 = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    .toISOString().substring(0, 10); // YYYY-MM-DD

  // Dia-calendário anterior: subtrair 1 dia do calendário, não 24h do wall-clock
  // (evita janela errada entre 21h–23h59 quando UTC já virou para o dia seguinte)
  const [y, m, d] = date2.split('-').map(Number);
  const date1 = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().substring(0, 10);

  return [
    'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline',
    `/${LAT},${LON}/${date1}/${date2}`,
    '?unitGroup=metric',
    '&include=hours',
    '&elements=datetime,precip,preciptype',
    `&key=${KEY}`
  ].join('');
}

/**
 * Tenta fetch do Visual Crossing com retry automático e backoff exponencial.
 * Retorna os dados JSON ou lança erro após MAX_RETRIES tentativas.
 * @param {string} url - URL completa (com key) construída por buildUrl()
 * @returns {Promise<Object>}
 */
async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Visual Crossing HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[visual-crossing] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}. Aguardando ${waitMs / 1000}s...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastErr;
}

/**
 * Busca precipitação horária observada do Visual Crossing e persiste em weather_observations.
 * Atualiza forecasts_meta.precip_48h_mm com o total real observado.
 *
 * Nunca faz throw — padrão no-throw D-10.
 * Chamado exclusivamente pelo scheduler — nunca em request de usuário.
 *
 * @returns {Promise<void>}
 */
async function fetchAndCacheObservations() {
  // Guard D-08: retorna silenciosamente se a chave não estiver configurada
  if (!process.env.VISUAL_CROSSING_API_KEY) {
    console.warn('[visual-crossing] API key ausente — fonte ignorada');
    return;
  }

  // Outer try/catch: padrão no-throw D-10
  try {
    const url = buildUrl();
    const data = await fetchWithRetry(url);

    // Validar estrutura mínima da resposta
    if (!data?.days?.length) {
      console.warn('[visual-crossing] Resposta sem campo days — fonte ignorada');
      return;
    }

    const db = getDb();
    let totalMm = 0;

    // Transação BEGIN/COMMIT/ROLLBACK — mesmo padrão do forecastService
    db.run('BEGIN');
    try {
      for (const day of data.days ?? []) {
        for (const hour of day.hours ?? []) {
          // Pitfall 4: combinar data do dia + hora da hora corretamente
          // "2026-04-22" + "T" + "01:00:00".substring(0, 5) → "2026-04-22T01:00"
          const mm = hour.precip ?? 0;
          const observed_time = `${day.datetime}T${hour.datetime.substring(0, 5)}`;
          totalMm += mm;

          // D-12: INSERT OR IGNORE — observações históricas são imutáveis
          // Parâmetros preparados — sem concatenação SQL (T-09.1-02-05)
          db.run(
            `INSERT OR IGNORE INTO weather_observations
               (bairro, observed_time, precipitacao_mm, fonte, fetched_at)
             VALUES ('florianopolis', ?, ?, 'visual-crossing', datetime('now'))`,
            [observed_time, mm]
          );
        }
      }
      db.run('COMMIT');
    } catch (dbErr) {
      try { db.run('ROLLBACK'); } catch (_) {}
      console.error('[visual-crossing] Erro ao persistir observacoes:', dbErr.message);
      return;
    }

    // D-11: UPDATE forecasts_meta executado APÓS o COMMIT
    const rounded = Math.round(totalMm * 10) / 10;
    db.run(
      `UPDATE forecasts_meta SET precip_48h_mm = ? WHERE id = 1`,
      [rounded]
    );

    console.log(
      `[visual-crossing] ${data.queryCost ?? '?'} records; precip_obs: ${rounded}mm -> forecasts_meta atualizado`
    );
  } catch (err) {
    // No-throw: loga e retorna — sistema continua operando com valor Open-Meteo anterior
    console.error(`[visual-crossing] Falha apos ${MAX_RETRIES} tentativas: ${err.message}. Fonte ignorada.`);
  }
}

module.exports = { fetchAndCacheObservations };
