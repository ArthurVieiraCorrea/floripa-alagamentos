'use strict';
// alertas.js
// GET /api/alertas/pendentes — retorna alertas não fechados do usuário autenticado.
// POST /api/alertas/marcar-visto — marca alertas especificados como vistos (atualiza visto_em).
// ALERT-05: usado pelo polling de 60s do frontend para exibir banner in-app.

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/alertas/pendentes
// Retorna alertas do usuário autenticado onde visto_em IS NULL.
// Resposta: { alertas: [{ id, google_event_id, bairro, score, summary, enviado_em }] }
router.get('/pendentes', requireAuth, (req, res) => {
  const db = getDb();
  try {
    const alertas = db.all(
      `SELECT id, google_event_id, bairro, score, summary, enviado_em
         FROM alertas_enviados
        WHERE usuario_id = ?
          AND visto_em IS NULL
        ORDER BY enviado_em DESC
        LIMIT 20`,
      [req.session.userId]
    );
    res.json({ alertas: alertas || [] });
  } catch (err) {
    console.error('[alertas] Erro ao buscar pendentes:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/alertas/marcar-visto
// Body: { ids: [number, ...] } — array de alertas_enviados.id a marcar como vistos.
// Usado como complemento ao localStorage — permite marcar visto no servidor
// para evitar que banner reapareça em outra sessão/dispositivo.
// Aceita também ids=[0] para marcar TODOS os pendentes do usuário.
router.post('/marcar-visto', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ erro: 'ids deve ser um array não vazio' });
  }
  const db = getDb();
  try {
    if (ids.length === 1 && ids[0] === 0) {
      // ids=[0] marca todos os pendentes do usuário
      db.run(
        `UPDATE alertas_enviados
            SET visto_em = datetime('now')
          WHERE usuario_id = ? AND visto_em IS NULL`,
        [req.session.userId]
      );
    } else {
      // Marcar apenas os ids especificados (validar que pertencem ao usuário)
      const placeholders = ids.map(() => '?').join(',');
      db.run(
        `UPDATE alertas_enviados
            SET visto_em = datetime('now')
          WHERE usuario_id = ? AND id IN (${placeholders}) AND visto_em IS NULL`,
        [req.session.userId, ...ids]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[alertas] Erro ao marcar como visto:', err.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
