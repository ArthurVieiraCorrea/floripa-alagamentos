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

const router = express.Router();

// Middleware de texto para a rota de preview (CSV raw no body)
const csvText = express.text({ type: ['text/plain', 'text/csv', 'application/octet-stream'], limit: '5mb' });

// POST /api/admin/preview
router.post('/preview', requireAuth, csvText, AdminController.preview);

// POST /api/admin/confirmar
router.post('/confirmar', requireAuth, express.json(), AdminController.confirmar);

module.exports = router;
