'use strict';
// previsao.js
// GET /api/previsao/atual — retorna dados de forecast cacheados com metadados.
// Nunca aciona chamadas externas (PREV-02).

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// Janela de horas futuras retornada por padrão (72h cobre todos os horizontes do dashboard)
const FORECAST_HOURS = 72;

/**
 * GET /api/previsao/atual
 *
 * Resposta:
 * {
 *   meta: { status, last_fetched_at, precip_48h_mm },
 *   forecasts: [{ forecast_time, precipitacao_mm, fonte }]  // próximas 72h
 * }
 *
 * Retorna 503 se o cache ainda está pendente (nunca populado).
 */
router.get('/atual', (req, res) => {
  const db = getDb();

  const meta = db.get(`SELECT status, last_fetched_at, precip_48h_mm, last_error FROM forecasts_meta WHERE id = 1`);

  if (!meta || meta.status === 'pending') {
    return res.status(503).json({
      erro: 'Cache de previsão ainda não populado. Tente novamente em alguns segundos.',
      status: meta?.status ?? 'pending',
    });
  }

  const now = new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  const limit = new Date(Date.now() + FORECAST_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const forecasts = db.all(
    `SELECT forecast_time, precipitacao_mm, fonte
       FROM forecasts
      WHERE bairro = 'florianopolis'
        AND forecast_time >= ?
        AND forecast_time <= ?
      ORDER BY forecast_time ASC`,
    [now, limit]
  );

  res.json({
    meta: {
      status: meta.status,
      last_fetched_at: meta.last_fetched_at,
      precip_48h_mm: meta.precip_48h_mm,
    },
    forecasts,
  });
});

module.exports = router;
