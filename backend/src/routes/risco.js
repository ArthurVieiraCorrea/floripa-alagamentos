'use strict';
// risco.js
// D-07: GET /api/risco/bairros?window=24  — lista todos os bairros com score
// D-08: GET /api/risco/:bairro?window=24  — detalhe por bairro

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

const VALID_WINDOWS = [24, 48, 72];

/**
 * GET /api/risco/bairros?window=24
 *
 * Retorna todos os bairros com score para o horizonte solicitado.
 * 503 se risk_scores ainda não foi populado.
 * 400 se window inválido.
 *
 * Resposta:
 * {
 *   window_hours: 24,
 *   scores: [{ bairro, score, nivel, precipitacao_prevista_mm,
 *              ocorrencias_historicas_count, insufficient_data, calculated_at }]
 * }
 */
router.get('/bairros', (req, res) => {
  const window = parseInt(req.query.window, 10) || 24;

  if (!VALID_WINDOWS.includes(window)) {
    return res.status(400).json({
      erro: 'Parâmetro window inválido. Use 24, 48 ou 72.',
    });
  }

  const db = getDb();
  const rows = db.all(
    `SELECT bairro, score, nivel, precipitacao_prevista_mm,
            ocorrencias_historicas_count, insufficient_data, calculated_at
       FROM risk_scores
      WHERE window_hours = ?
      ORDER BY bairro ASC`,
    [window]
  );

  if (rows.length === 0) {
    return res.status(503).json({
      erro: 'Risk scores ainda não calculados. Tente novamente em alguns segundos.',
      status: 'pending',
    });
  }

  // Converter insufficient_data de inteiro SQLite (0/1) para booleano
  const scores = rows.map(r => ({
    ...r,
    insufficient_data: r.insufficient_data === 1,
  }));

  res.json({ window_hours: window, scores });
});

/**
 * GET /api/risco/:bairro?window=24
 *
 * Retorna score detalhado para um bairro específico.
 * 400 se window inválido.
 * 404 se bairro não encontrado ou scores ainda não calculados.
 *
 * Resposta:
 * { bairro, window_hours, score, nivel, precipitacao_prevista_mm,
 *   ocorrencias_historicas_count, insufficient_data, calculated_at }
 */
router.get('/:bairro', (req, res) => {
  const window = parseInt(req.query.window, 10) || 24;

  if (!VALID_WINDOWS.includes(window)) {
    return res.status(400).json({
      erro: 'Parâmetro window inválido. Use 24, 48 ou 72.',
    });
  }

  // Truncar param a 100 chars para evitar reflection excessiva em mensagem de erro
  const bairroParam = String(req.params.bairro).slice(0, 100);

  const db = getDb();
  const row = db.get(
    `SELECT bairro, window_hours, score, nivel, precipitacao_prevista_mm,
            ocorrencias_historicas_count, insufficient_data, calculated_at
       FROM risk_scores
      WHERE bairro = ? AND window_hours = ?`,
    [bairroParam, window]
  );

  if (!row) {
    return res.status(404).json({
      erro: `Bairro '${bairroParam}' não encontrado ou scores ainda não calculados.`,
    });
  }

  res.json({
    ...row,
    insufficient_data: row.insufficient_data === 1,
  });
});

module.exports = router;
