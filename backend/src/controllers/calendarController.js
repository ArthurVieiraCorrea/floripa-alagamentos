'use strict';
// calendarController.js
// CAL-01: conectar Google Calendar
// CAL-04: associar bairro manualmente a evento
// CAL-05: desconectar calendário sem perder conta

const { getDb } = require('../config/database');
const { syncUserCalendar } = require('../services/calendarService');

/**
 * POST /api/calendar/connect
 * Conecta o Google Calendar do usuário autenticado.
 * Verifica se o usuário tem refresh_token_enc — se não tiver, retorna 400
 * (usuário deve fazer logout e login novamente para obter o token com calendar.readonly scope).
 * Ao conectar, dispara uma sincronização imediata em background.
 */
async function conectar(req, res) {
  const db = getDb();
  const usuario = db.get(
    `SELECT id, refresh_token_enc, calendar_connected FROM usuarios WHERE id = ?`,
    [req.session.userId]
  );

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  if (!usuario.refresh_token_enc) {
    return res.status(400).json({
      erro: 'Token de autenticação ausente. Faça logout e login novamente para conceder acesso ao calendário.',
    });
  }

  db.run(
    `UPDATE usuarios SET calendar_connected = 1, calendar_disconnected = 0,
      atualizado_em = datetime('now','localtime') WHERE id = ?`,
    [usuario.id]
  );

  // Sincronizar imediatamente em background (não bloqueia resposta)
  syncUserCalendar({ id: usuario.id, refresh_token_enc: usuario.refresh_token_enc })
    .catch(err => console.error('[calendarController] Erro na sync inicial:', err.message));

  res.json({ ok: true, mensagem: 'Calendário conectado. Sincronização em andamento.' });
}

/**
 * DELETE /api/calendar/disconnect
 * Desconecta o calendário SEM apagar refresh_token_enc (mantém sessão de login intacta).
 * Deleta todas as linhas do usuário em calendar_events_cache.
 * Reseta calendar_disconnected para 0 (limpeza de flag de invalid_grant anterior).
 */
function desconectar(req, res) {
  const db = getDb();

  db.run(
    `UPDATE usuarios SET calendar_connected = 0, calendar_disconnected = 0,
      atualizado_em = datetime('now','localtime') WHERE id = ?`,
    [req.session.userId]
  );

  db.run(
    `DELETE FROM calendar_events_cache WHERE usuario_id = ?`,
    [req.session.userId]
  );

  res.json({ ok: true, mensagem: 'Calendário desconectado.' });
}

/**
 * GET /api/calendar/eventos
 * Retorna eventos em cache para o usuário autenticado, ordenados por start_time.
 * Inclui bairro_resolvido (null quando não resolvido automaticamente).
 * Inclui location original para exibição na UI (CAL-04: usuário precisa do texto para decidir bairro).
 */
function listarEventos(req, res) {
  const db = getDb();
  const eventos = db.all(
    `SELECT google_event_id, summary, start_time, end_time,
            location, bairro_resolvido, synced_at
     FROM calendar_events_cache
     WHERE usuario_id = ?
     ORDER BY start_time ASC`,
    [req.session.userId]
  );

  res.json({ eventos });
}

/**
 * PATCH /api/calendar/eventos/:googleEventId
 * Associa manualmente um bairro a um evento (CAL-04).
 * Body: { bairro: string }
 * Valida que o bairro é uma string não vazia antes de salvar.
 */
function atualizarBairro(req, res) {
  const { googleEventId } = req.params;
  const { bairro } = req.body;

  if (!bairro || typeof bairro !== 'string' || bairro.trim().length === 0) {
    return res.status(400).json({ erro: 'Campo bairro é obrigatório e deve ser uma string não vazia.' });
  }

  const db = getDb();

  db.run(
    `UPDATE calendar_events_cache
     SET bairro_resolvido = ?
     WHERE usuario_id = ? AND google_event_id = ?`,
    [bairro.trim(), req.session.userId, googleEventId]
  );

  // node-sqlite3-wasm: verificar se linha existe após o UPDATE
  const evento = db.get(
    `SELECT google_event_id FROM calendar_events_cache
     WHERE usuario_id = ? AND google_event_id = ?`,
    [req.session.userId, googleEventId]
  );

  if (!evento) {
    return res.status(404).json({ erro: 'Evento não encontrado.' });
  }

  res.json({ ok: true, google_event_id: googleEventId, bairro_resolvido: bairro.trim() });
}

module.exports = { conectar, desconectar, listarEventos, atualizarBairro };
