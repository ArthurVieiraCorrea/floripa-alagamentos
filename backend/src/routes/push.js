'use strict';
// push.js
// POST /api/push/subscribe  — salva subscription do usuário autenticado
// DELETE /api/push/unsubscribe — remove subscription pelo endpoint
// PATCH /api/push/threshold — atualiza alert_threshold do usuário (D-13, ALERT-04)
// GET /api/push/vapid-public-key — retorna chave pública VAPID para o frontend

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/push/vapid-public-key — retorna chave pública VAPID para o frontend
// Intencionalmente público (VAPID public key não é segredo por design — RFC 8030)
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// POST /api/push/subscribe
// Body: { endpoint, keys: { p256dh, auth } }
// Salva ou substitui subscription (INSERT OR REPLACE via UNIQUE endpoint).
router.post('/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ erro: 'endpoint, keys.p256dh e keys.auth são obrigatórios' });
  }
  const db = getDb();
  try {
    db.run(
      `INSERT OR REPLACE INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)`,
      [req.session.userId, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[push] Erro ao salvar subscription:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/push/unsubscribe
// Body: { endpoint }
// Remove subscription pelo endpoint.
router.delete('/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ erro: 'endpoint é obrigatório' });
  const db = getDb();
  try {
    db.run(
      `DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?`,
      [req.session.userId, endpoint]
    );
    res.status(204).end();
  } catch (err) {
    console.error('[push] Erro ao remover subscription:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PATCH /api/push/threshold
// Body: { threshold: number } — valores válidos: 26 (Amarelo), 51 (Laranja), 76 (Vermelho), 1 (Verde)
// Atualiza alert_threshold do usuário autenticado.
router.patch('/threshold', requireAuth, (req, res) => {
  const { threshold } = req.body;
  const VALID_THRESHOLDS = [1, 26, 51, 76];
  if (!VALID_THRESHOLDS.includes(Number(threshold))) {
    return res.status(400).json({ erro: 'threshold deve ser 1 (Verde), 26 (Amarelo), 51 (Laranja) ou 76 (Vermelho)' });
  }
  const db = getDb();
  try {
    db.run(
      `UPDATE usuarios SET alert_threshold = ?, atualizado_em = datetime('now') WHERE id = ?`,
      [Number(threshold), req.session.userId]
    );
    res.json({ ok: true, threshold: Number(threshold) });
  } catch (err) {
    console.error('[push] Erro ao atualizar threshold:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PATCH /api/push/alert-hours
// Body: { hours_before: number } — valores válidos: 1, 2, 6, 12, 24, 48
// Atualiza antecedência de alerta do usuário autenticado.
router.patch('/alert-hours', requireAuth, (req, res) => {
  const { hours_before } = req.body;
  const VALID_HOURS = [1, 2, 6, 12, 24, 48];
  if (!VALID_HOURS.includes(Number(hours_before))) {
    return res.status(400).json({ erro: 'hours_before deve ser 1, 2, 6, 12, 24 ou 48' });
  }
  const db = getDb();
  try {
    db.run(
      `UPDATE usuarios SET alert_hours_before = ?, atualizado_em = datetime('now') WHERE id = ?`,
      [Number(hours_before), req.session.userId]
    );
    res.json({ ok: true, hours_before: Number(hours_before) });
  } catch (err) {
    console.error('[push] Erro ao atualizar alert_hours_before:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
