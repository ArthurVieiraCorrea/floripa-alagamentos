'use strict';
// forecastService.js
// Busca previsão de precipitação do Open-Meteo e persiste em cache SQLite.
// PREV-01: Open-Meteo como fonte primária; INMET não viável (TLS failure empiricamente confirmado).
// PREV-02: Nunca chamado em request de usuário — somente pelo scheduler.
// PREV-04: Acumulado 48h calculado e salvo em forecasts_meta.precip_48h_mm.

const { getDb } = require('../config/database');

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=-27.5954&longitude=-48.5480' +
  '&hourly=precipitation%2Crain%2Cshowers' +
  '&past_hours=48&forecast_days=7' +
  '&timezone=America%2FSao_Paulo';

// Santa Catarina: UTC-3 fixo (sem DST desde Decreto 9.242/2019)
const UTC_OFFSET = '-03:00';

// Timeout de 10s para o fetch — evita conexões travadas penduradas no processo
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Busca previsão do Open-Meteo, normaliza e persiste em cache SQLite.
 * Nunca faz throw — em caso de erro, atualiza forecasts_meta.status='error' e retorna.
 * Cache stale permanece válido após falha.
 *
 * @returns {Promise<void>}
 */
async function fetchAndCacheForecasts() {
  const db = getDb();

  let data;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(OPEN_METEO_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status} ${res.statusText}`);
    }

    data = await res.json();
  } catch (err) {
    // INMET fallback: log aviso apenas — não há endpoint INMET confiável em v1
    console.warn('[forecast] INMET não disponível como fallback (TLS failure confirmado). Servindo cache stale.');
    console.error('[forecast] Fetch Open-Meteo falhou:', err.message);

    try {
      db.run(
        `UPDATE forecasts_meta SET status='error', last_error=? WHERE id=1`,
        [err.message]
      );
    } catch (dbErr) {
      console.error('[forecast] Falha ao atualizar forecasts_meta:', dbErr.message);
    }
    return; // Não re-throw — cache stale permanece válido
  }

  const times   = data.hourly?.time          ?? [];
  const precips = data.hourly?.precipitation ?? [];

  if (times.length === 0) {
    console.error('[forecast] Resposta Open-Meteo vazia ou sem campo hourly.time');
    db.run(
      `UPDATE forecasts_meta SET status='error', last_error=? WHERE id=1`,
      ['Resposta Open-Meteo sem dados hourly']
    );
    return;
  }

  const now = new Date();
  let precip48h = 0;

  try {
    db.run('BEGIN');

    for (let i = 0; i < times.length; i++) {
      // Append UTC offset: Open-Meteo retorna "2026-04-06T01:00" sem offset
      // new Date("2026-04-06T01:00") seria interpretado como UTC — incorreto
      const entryTime = new Date(times[i] + UTC_OFFSET);
      const mm = precips[i] ?? 0; // null nos últimos ~7 entries → tratar como 0

      // PREV-04: acumular apenas dados históricos (anteriores ao momento atual)
      if (entryTime <= now) {
        precip48h += mm;
      }

      db.run(
        `INSERT OR REPLACE INTO forecasts
           (bairro, forecast_time, precipitacao_mm, fonte, fetched_at)
         VALUES ('florianopolis', ?, ?, 'open-meteo', datetime('now'))`,
        [times[i], mm]
      );
    }

    db.run('COMMIT');
  } catch (dbErr) {
    try { db.run('ROLLBACK'); } catch (_) {}
    console.error('[forecast] Erro ao persistir no banco:', dbErr.message);
    db.run(
      `UPDATE forecasts_meta SET status='error', last_error=? WHERE id=1`,
      [dbErr.message]
    );
    return;
  }

  // Arredondar para 1 casa decimal
  precip48h = Math.round(precip48h * 10) / 10;

  db.run(
    `INSERT OR REPLACE INTO forecasts_meta
       (id, last_fetched_at, status, precip_48h_mm, last_error)
     VALUES (1, datetime('now'), 'ok', ?, NULL)`,
    [precip48h]
  );

  console.log(
    `[forecast] Cache atualizado: ${times.length} entradas; ` +
    `48h acumulado=${precip48h.toFixed(1)}mm`
  );
}

module.exports = { fetchAndCacheForecasts };
