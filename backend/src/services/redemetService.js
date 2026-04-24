'use strict';
// redemetService.js
// Busca METAR horario do SBFL (aeroporto de Florianopolis) via REDEMET API e persiste
// em weather_observations com precipitacao_mm=0 sempre.
//
// LIMITACAO CRITICA: METARs brasileiros NAO incluem P-group (P0015 etc.) conforme
// ICAO Annex 3 — adicao exclusiva de estacoes NWS/FAA norte-americanas.
// Estrategia: precipitacao_mm = 0 SEMPRE para fonte 'redemet-metar'.
// Valor do servico e QUALITATIVO: confirmar presenca/ausencia de precipitacao e
// logar o tipo (RA, TSRA, DZ) para rastreabilidade e validacao cruzada.
//
// D-09: Sem REDEMET_API_KEY, servico loga aviso e retorna sem throw.
// D-10: Erros de rede/parse sao tratados sem throw — sistema continua operando.

const { getDb } = require('../config/database');

// Timeout de 10s para o fetch — evita conexoes travadas no processo
const FETCH_TIMEOUT_MS = 10_000;

// Retry: 3 tentativas com backoff exponencial (5s, 10s, 20s)
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
 * Constroi a URL do endpoint REDEMET METAR/SBFL com hora UTC atual.
 * A API key e inserida apenas na URL — nunca logada via console.*.
 * @returns {string}
 */
function buildUrl() {
  const KEY = process.env.REDEMET_API_KEY;
  const nowUtc = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dataHora = [
    nowUtc.getUTCFullYear(),
    pad(nowUtc.getUTCMonth() + 1),
    pad(nowUtc.getUTCDate()),
    pad(nowUtc.getUTCHours())
  ].join(''); // ex: "2026042314"
  return `https://api-redemet.decea.mil.br/mensagens/metar/SBFL?api_key=${KEY}&data_ini=${dataHora}&data_fim=${dataHora}`;
}

/**
 * Tenta fetch da URL informada com retry automatico e backoff exponencial.
 * Retorna os dados JSON ou lanca erro apos MAX_RETRIES tentativas.
 * @param {string} url
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
      if (!res.ok) throw new Error(`REDEMET HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[redemet] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}. Aguardando ${waitMs / 1000}s...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastErr;
}

/**
 * Busca METARs horarios do SBFL via REDEMET API e persiste em weather_observations.
 * - precipitacao_mm = 0 SEMPRE (METARs brasileiros nao fornecem P-group quantitativo)
 * - fonte = 'redemet-metar'
 * - Timestamps convertidos de UTC (convencao aeronautica ICAO) para UTC-3 (Florianopolis)
 * - NAO atualiza forecasts_meta.precip_48h_mm (responsabilidade exclusiva do visualCrossingService)
 * - Nunca faz throw — erros sao logados e servico retorna graciosamente (D-10)
 *
 * @returns {Promise<void>}
 */
async function fetchAndCacheObservations() {
  // Guard D-09: sem API key, ignorar fonte graciosamente
  if (!process.env.REDEMET_API_KEY) {
    console.warn('[redemet] API key ausente — fonte ignorada');
    return;
  }

  try {
    const url = buildUrl();
    const data = await fetchWithRetry(url);

    // Validar estrutura da resposta
    if (!data?.status) {
      console.warn('[redemet] Resposta inesperada:', JSON.stringify(data).substring(0, 200));
      return;
    }

    // data.data.data[] — array duplamente aninhado conforme documentacao DECEA
    const registros = data?.data?.data ?? [];
    if (registros.length === 0) {
      console.log('[redemet] Nenhum METAR disponivel para este periodo');
      return;
    }

    const db = getDb();
    db.run('BEGIN');
    try {
      for (const registro of registros) {
        const mens = registro.mens ?? '';

        // Parsing qualitativo do grupo de tempo presente
        // Grupos suportados: -RA, RA, +RA, TSRA, -DZ, DZ, RASN, SHRA, FZRA etc.
        // METAR brasileiro NAO contem P-group — apenas informacao qualitativa disponivel
        const precipMatch = mens.match(/\s(-|\+)?(VC)?(TS|SH|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS)/);
        const tipoQualitativo = precipMatch ? precipMatch[0].trim() : null;

        // Converter validade_inicial (UTC per convencao aeronautica ICAO) para UTC-3
        // Santa Catarina: UTC-3 fixo (sem DST desde Decreto 9.242/2019)
        // validade_inicial formato: "2026-04-23 14:00:00"
        const utcTime = new Date(registro.validade_inicial.replace(' ', 'T') + 'Z');
        const localMs = utcTime.getTime() - 3 * 60 * 60 * 1000;
        const observed_time = new Date(localMs).toISOString().substring(0, 16); // "2026-04-23T11:00"

        // precipitacao_mm = 0 SEMPRE para fonte redemet-metar (sem dado quantitativo)
        // INSERT OR IGNORE — observacoes historicas sao imutaveis
        db.run(
          `INSERT OR IGNORE INTO weather_observations
             (bairro, observed_time, precipitacao_mm, fonte, fetched_at)
           VALUES ('florianopolis', ?, 0, 'redemet-metar', datetime('now'))`,
          [observed_time]
        );

        if (tipoQualitativo) {
          console.log(`[redemet] SBFL ${observed_time}: ${tipoQualitativo} (qualitativo; sem mm)`);
        }
      }
      db.run('COMMIT');
    } catch (dbErr) {
      try { db.run('ROLLBACK'); } catch (_) {}
      console.error('[redemet] Erro ao persistir observacoes:', dbErr.message);
      return;
    }

    console.log(`[redemet] ${registros.length} METAR(s) processados para SBFL`);
  } catch (err) {
    // D-10: sem re-throw — sistema continua operando sem dados REDEMET
    console.error(`[redemet] Falha apos ${MAX_RETRIES} tentativas: ${err.message}. Fonte ignorada.`);
    return;
  }
}

module.exports = { fetchAndCacheObservations };
