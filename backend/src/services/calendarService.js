'use strict';
// calendarService.js
// CAL-02: busca eventos do calendário primário nas próximas 72h.
// CAL-03: tenta resolver campo location para bairro de Florianópolis.
// Tratamento de invalid_grant: marca calendar_disconnected=1 sem relançar exceção.

const { google } = require('googleapis');
const { getDb } = require('../config/database');
const { decrypt } = require('./crypto');
const { BAIRROS_FLORIANOPOLIS, normalizarNome } = require('../constants/bairros');

// ── OAuth2Client por usuário ──────────────────────────────────────────────────

/**
 * Constrói um OAuth2Client autenticado com o refresh_token do usuário.
 * A biblioteca googleapis faz refresh automático do access_token ao chamar a API.
 * NÃO chamar refreshAccessToken() manualmente.
 * @param {string} refreshTokenEnc — valor criptografado de usuarios.refresh_token_enc
 * @returns {google.auth.OAuth2}
 */
function buildOAuth2ClientForUser(refreshTokenEnc) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: decrypt(refreshTokenEnc),
  });
  return oauth2Client;
}

// ── Busca de eventos ──────────────────────────────────────────────────────────

/**
 * Busca eventos do calendário primário do usuário nas próximas 72h.
 * singleEvents:true é obrigatório junto com orderBy:'startTime' (sem ele: 400).
 * @param {google.auth.OAuth2} oauth2Client
 * @returns {Promise<Array>} array de itens de eventos (pode ser vazio)
 */
async function fetchEventsFor72h(oauth2Client) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: in72h.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
    fields: 'items(id,summary,start,end,location)',
  });

  return data.items ?? [];
}

// ── Resolução de localização para bairro ─────────────────────────────────────

/**
 * Tenta resolver texto livre de location para um bairro canônico.
 * Nível 1: correspondência exata (normalizada).
 * Nível 2: o texto contém o nome do bairro como substring.
 * Retorna null se não resolvido — não bloqueia sincronização.
 * @param {string|null|undefined} locationText
 * @returns {string|null}
 */
function resolverBairro(locationText) {
  if (!locationText) return null;
  const norm = normalizarNome(locationText);

  // Nível 1: match exato normalizado
  for (const bairro of BAIRROS_FLORIANOPOLIS) {
    if (normalizarNome(bairro) === norm) return bairro;
  }

  // Nível 2: location contém o nome do bairro como substring
  for (const bairro of BAIRROS_FLORIANOPOLIS) {
    if (norm.includes(normalizarNome(bairro))) return bairro;
  }

  return null;
}

// ── Normalização de datas ─────────────────────────────────────────────────────

/**
 * Converte start/end de evento Calendar para string ISO 8601.
 * Eventos com start.dateTime: usar como está.
 * Eventos all-day com start.date: normalizar para UTC midnight ('2026-04-10T00:00:00.000Z').
 * @param {{ dateTime?: string, date?: string }} startOrEnd
 * @returns {string}
 */
function normalizarDataEvento(startOrEnd) {
  if (startOrEnd.dateTime) return startOrEnd.dateTime;
  // All-day event: 'YYYY-MM-DD' → UTC midnight ISO 8601
  return new Date(startOrEnd.date + 'T00:00:00.000Z').toISOString();
}

// ── Sincronização por usuário ─────────────────────────────────────────────────

/**
 * Sincroniza eventos do calendário de um único usuário.
 * Em caso de invalid_grant: marca calendar_disconnected=1 e retorna sem relançar.
 * Persiste via INSERT OR REPLACE — sem duplicatas em re-sincronizações.
 * @param {{ id: number, refresh_token_enc: string }} usuario
 * @returns {Promise<void>}
 */
async function syncUserCalendar(usuario) {
  try {
    const oauth2Client = buildOAuth2ClientForUser(usuario.refresh_token_enc);
    const events = await fetchEventsFor72h(oauth2Client);
    const db = getDb();

    // Remover eventos anteriores do usuário antes de re-inserir
    // (evita acúmulo de eventos expirados fora da janela de 72h)
    db.run(
      `DELETE FROM calendar_events_cache WHERE usuario_id = ?`,
      [usuario.id]
    );

    db.run('BEGIN');
    try {
      for (const event of events) {
        const startTime = normalizarDataEvento(event.start);
        const endTime   = normalizarDataEvento(event.end);
        const bairro    = resolverBairro(event.location);

        db.run(
          `INSERT OR REPLACE INTO calendar_events_cache
             (usuario_id, google_event_id, summary, start_time, end_time,
              location, bairro_resolvido, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [usuario.id, event.id, event.summary ?? null,
           startTime, endTime, event.location ?? null, bairro]
        );
      }
      db.run('COMMIT');
    } catch (err) {
      try { db.run('ROLLBACK'); } catch (_) {}
      console.error('[calendarService] Erro ao persistir eventos do usuario', usuario.id, err.message);
      return;
    }

    console.log(`[calendarService] ${events.length} eventos sincronizados para usuario ${usuario.id}`);
  } catch (err) {
    const isInvalidGrant =
      err.message?.includes('invalid_grant') ||
      err.response?.data?.error === 'invalid_grant';

    if (isInvalidGrant) {
      // Marcar usuário como desconectado — ALERT-06 lê esta flag na Fase 6
      getDb().run(
        `UPDATE usuarios SET calendar_connected = 0, calendar_disconnected = 1
         WHERE id = ?`,
        [usuario.id]
      );
      console.warn(`[calendarService] invalid_grant para usuario ${usuario.id} — calendário desconectado`);
      return;
    }

    console.error('[calendarService] Erro ao sincronizar usuario', usuario.id, err.message);
    // Não relança — outros usuários devem continuar
  }
}

// ── Sincronização de todos os usuários conectados ─────────────────────────────

/**
 * Sincroniza calendários de todos os usuários com calendar_connected=1
 * e calendar_disconnected=0. Pula usuários sem refresh_token_enc.
 * Chamado pelo scheduler a cada 30min (Plan 02).
 * @returns {Promise<void>}
 */
async function syncAllConnectedUsers() {
  const db = getDb();
  const usuarios = db.all(
    `SELECT id, refresh_token_enc FROM usuarios
     WHERE calendar_connected = 1
       AND calendar_disconnected = 0
       AND refresh_token_enc IS NOT NULL`
  );

  console.log(`[calendarService] Sincronizando ${usuarios.length} usuario(s) conectado(s)`);

  for (const usuario of usuarios) {
    await syncUserCalendar(usuario);
  }
}

module.exports = { fetchEventsFor72h, resolverBairro, syncUserCalendar, syncAllConnectedUsers };
