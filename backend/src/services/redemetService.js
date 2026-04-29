'use strict';
// redemetService.js → substituído por Open-Meteo NWP historical
// Busca precipitação horária observada das últimas 24h do Open-Meteo (gratuito, sem API key)
// e persiste em weather_observations com precipitacao_mm reais.
//
// Open-Meteo retorna análise NWP para horas passadas via past_hours — dado quantitativo real,
// sem a limitação dos METARs brasileiros (que não incluem P-group).
//
// D-10: Nunca re-throw — erros de rede/parse logados; sistema continua operando.
// D-12: INSERT OR IGNORE — observações históricas são imutáveis.
// Sem guard de API key — Open-Meteo é público e não requer autenticação.

const { getDb } = require('../config/database');

const LAT = -27.5954;
const LON = -48.5480;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl() {
  // past_hours=24 → últimas 24h; forecast_days=0 → sem dados de previsão futura
  // timezone=America/Sao_Paulo → timestamps em UTC-3 (Santa Catarina, sem DST)
  return (
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${LAT}&longitude=${LON}` +
    '&hourly=precipitation' +
    '&past_hours=24&forecast_days=0' +
    '&timezone=America%2FSao_Paulo'
  );
}

async function fetchWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const waitMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[open-meteo-obs] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}. Aguardando ${waitMs / 1000}s...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastErr;
}

/**
 * Busca precipitação horária das últimas 24h do Open-Meteo e persiste em weather_observations.
 * Nunca faz throw — padrão no-throw D-10.
 * @returns {Promise<void>}
 */
async function fetchAndCacheObservations() {
  try {
    const url = buildUrl();
    const data = await fetchWithRetry(url);

    const times = data?.hourly?.time;
    const precips = data?.hourly?.precipitation;

    if (!Array.isArray(times) || !Array.isArray(precips) || times.length === 0) {
      console.warn('[open-meteo-obs] Resposta inesperada ou vazia:', JSON.stringify(data).substring(0, 200));
      return;
    }

    const db = getDb();
    let count = 0;

    db.run('BEGIN');
    try {
      for (let i = 0; i < times.length; i++) {
        // Open-Meteo retorna "2026-04-28T13:00" — já em UTC-3 (America/Sao_Paulo)
        const observed_time = times[i];
        const mm = precips[i] ?? 0;

        db.run(
          `INSERT OR IGNORE INTO weather_observations
             (bairro, observed_time, precipitacao_mm, fonte, fetched_at)
           VALUES ('florianopolis', ?, ?, 'open-meteo', datetime('now'))`,
          [observed_time, mm]
        );
        count++;
      }
      db.run('COMMIT');
    } catch (dbErr) {
      try { db.run('ROLLBACK'); } catch (_) {}
      console.error('[open-meteo-obs] Erro ao persistir observações:', dbErr.message);
      return;
    }

    console.log(`[open-meteo-obs] ${count} registros persistidos em weather_observations`);
  } catch (err) {
    // D-10: sem re-throw — sistema continua operando sem estes dados
    console.error(`[open-meteo-obs] Falha após ${MAX_RETRIES} tentativas: ${err.message}. Fonte ignorada.`);
  }
}

module.exports = { fetchAndCacheObservations };
