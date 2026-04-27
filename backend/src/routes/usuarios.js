'use strict';
// usuarios.js
// PATCH /api/usuarios/me — grava onboarding_done = 1 (UX-04, D-06, D-07)

const express       = require('express');
const router        = express.Router();
const { getDb }     = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// PATCH /api/usuarios/me — grava onboarding_done = 1 (UX-04, D-06, D-07)
// Requer sessão autenticada. Aceita apenas { onboarding_done: 1 }.
// Endpoint idempotente: chamar múltiplas vezes é seguro.
router.patch('/me', requireAuth, (req, res) => {
  const { onboarding_done } = req.body;
  if (onboarding_done !== 1) {
    return res.status(400).json({ erro: 'onboarding_done deve ser 1' });
  }
  const db = getDb();
  try {
    db.run(
      `UPDATE usuarios SET onboarding_done = 1, atualizado_em = datetime('now') WHERE id = ?`,
      [req.session.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[usuarios] Erro ao atualizar onboarding_done:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
