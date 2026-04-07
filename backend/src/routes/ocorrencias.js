'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const ctrl      = require('../controllers/ocorrenciaController');
const { requireAuth } = require('../middleware/auth');

// Rate limiter for public POST route — prevents flooding.
// 20 requests per 15 minutes per IP. In-memory store (single-process deployment).
// NOTE: if this app ever runs as multiple processes, switch to a shared store
// (e.g., Redis via rate-limit-redis) so limits are enforced across all instances.
const criarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 20,                  // v8 API: 'limit' (not 'max')
  standardHeaders: 'draft-8', // Ratelimit-* headers per RFC draft
  legacyHeaders: false,       // suppress deprecated X-RateLimit-* headers
  message: { erro: 'Muitas ocorrências enviadas. Tente novamente em alguns minutos.' },
});

// Route table:
// GET  /api/ocorrencias/recentes  — public
// GET  /api/ocorrencias/stats     — public
// GET  /api/ocorrencias           — public
// POST /api/ocorrencias           — public, rate-limited (AUTH-04)
// GET  /api/ocorrencias/:id       — public
// DELETE /api/ocorrencias/:id     — requires auth (AUTH-04)

router.get('/recentes',  ctrl.recentes);
router.get('/stats',     ctrl.estatisticas);
router.get('/',          ctrl.listar);
router.post('/',         criarLimiter, ctrl.criar);     // rate-limited, still public
router.get('/:id',       ctrl.buscarPorId);
router.delete('/:id',    requireAuth, ctrl.deletar);   // AUTH-04: auth required

module.exports = router;
