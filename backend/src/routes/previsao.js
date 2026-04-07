'use strict';
// routes/previsao.js
// GET /api/previsao/atual — serve dados cacheados do SQLite.
// PREV-02: NUNCA chama Open-Meteo diretamente.

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

router.get('/atual', (req, res) => {
  const db = getDb();

  let meta;
  try {
    meta = db.get('SELECT * FROM forecasts_meta WHERE id = 1');
  } catch (err) {
    console.error('[previsao] Erro ao ler forecasts_meta:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao acessar cache de previsão' });
  }

  // Status 'pending' = scheduler ainda não rodou (primeiros segundos após startup)
  if (!meta || meta.status === 'pending') {
    return res.status(503).json({
      erro: 'Previsão ainda não disponível. O cache está sendo carregado — tente novamente em instantes.',
      status: meta?.status ?? 'pending',
    });
  }

  const now = new Date();
  // last_fetched_at está em UTC no SQLite (datetime('now') sem modificador)
  const fetched = new Date(meta.last_fetched_at + 'Z');
  const staleMinutes = (now - fetched) / 60_000;

  let rows;
  try {
    // Retornar próximas 72h de previsão a partir de agora
    rows = db.all(
      `SELECT forecast_time, precipitacao_mm, fonte
       FROM forecasts
       WHERE bairro = 'florianopolis'
         AND forecast_time >= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime')
       ORDER BY forecast_time
       LIMIT 72`
    );
  } catch (err) {
    console.error('[previsao] Erro ao ler forecasts:', err.message);
    return res.status(500).json({ erro: 'Erro interno ao ler dados de previsão' });
  }

  return res.json({
    last_updated: meta.last_fetched_at,
    status: meta.status,
    stale: staleMinutes > 120, // stale se mais de 2h sem atualização
    precip_48h_mm: meta.precip_48h_mm,
    previsao: rows,
  });
});

module.exports = router;
