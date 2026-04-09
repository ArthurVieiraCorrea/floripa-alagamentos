'use strict';
const express = require('express');
const { conectar, desconectar, listarEventos, atualizarBairro } = require('../controllers/calendarController');

const router = express.Router();

// Middleware de autenticação inline (mesmo padrão de ocorrencias.js)
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

// Todas as rotas de calendário exigem autenticação
router.use(requireAuth);

router.post('/connect',                   conectar);        // CAL-01
router.delete('/disconnect',              desconectar);     // CAL-05
router.get('/eventos',                    listarEventos);   // CAL-02, CAL-03
router.patch('/eventos/:googleEventId',   atualizarBairro); // CAL-04

module.exports = router;
