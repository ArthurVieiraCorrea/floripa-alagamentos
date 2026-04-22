'use strict';
// Rotas de administração: importação de dados históricos via CSV (HIST-01, HIST-02, HIST-03)
//
// POST /api/admin/preview   — parse + valida + deduplica CSV, retorna prévia sem inserir
// POST /api/admin/confirmar — insere linhas previamente aprovadas, retorna relatório
//
// Ambas as rotas exigem autenticação (requireAuth).
// O frontend envia o texto CSV como body de tipo text/plain (sem multer).

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const AdminController = require('../controllers/adminController');
const { getDb } = require('../config/database');

const router = express.Router();

// Middleware de texto para a rota de preview (CSV raw no body)
const csvText = express.text({ type: ['text/plain', 'text/csv', 'application/octet-stream'], limit: '5mb' });

// POST /api/admin/preview
router.post('/preview', requireAuth, csvText, AdminController.preview);

// POST /api/admin/confirmar
router.post('/confirmar', requireAuth, express.json(), AdminController.confirmar);

// POST /api/admin/recalcular — dispara recálculo imediato do motor de risco
router.post('/recalcular', requireAuth, AdminController.recalcular);

// ── Ferramentas de teste (apenas em dev) ────────────────────────────────────
// POST /api/admin/test/stale-forecast — simula previsão antiga (3h atrás)
router.post('/test/stale-forecast', requireAuth, (req, res) => {
  const db = getDb();
  db.run(`UPDATE forecasts_meta SET last_fetched_at = datetime('now', '-3 hours') WHERE id = 1`);
  res.json({ ok: true, msg: 'last_fetched_at definido para 3h atrás — previsão agora stale' });
});

// POST /api/admin/test/reset-forecast — reseta timestamp para agora
router.post('/test/reset-forecast', requireAuth, (req, res) => {
  const db = getDb();
  db.run(`UPDATE forecasts_meta SET last_fetched_at = datetime('now') WHERE id = 1`);
  res.json({ ok: true, msg: 'last_fetched_at resetado para agora — previsão fresca' });
});

module.exports = router;
