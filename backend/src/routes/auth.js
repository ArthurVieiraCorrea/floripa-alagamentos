'use strict';
const express  = require('express');
const { google } = require('googleapis');
const { getDb }  = require('../config/database');
const { encrypt } = require('../services/crypto');

const router = express.Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Step 1 — redirect to Google consent screen
// prompt:'consent' is REQUIRED to receive refresh_token on every login.
// Without it Google skips the consent screen for returning users and omits refresh_token,
// which silently breaks Phase 5 Calendar integration.
router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  });
  res.redirect(url);
});

// Step 2 — exchange authorization code for tokens
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?auth_error=access_denied');

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2Api.userinfo.get();
    // userInfo: { id, email, name, picture }

    const db = getDb();
    const existing = db.get('SELECT id FROM usuarios WHERE google_id = ?', [userInfo.id]);

    // Only overwrite refresh_token_enc when Google issues a new token.
    // If tokens.refresh_token is null the user already has one stored — do not delete it.
    const encryptedToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    if (existing) {
      if (encryptedToken) {
        db.run(
          `UPDATE usuarios
           SET refresh_token_enc = ?, email = ?, nome = ?,
               atualizado_em = datetime('now','localtime')
           WHERE google_id = ?`,
          [encryptedToken, userInfo.email, userInfo.name, userInfo.id]
        );
      } else {
        // Update name/email only — preserve existing refresh token
        db.run(
          `UPDATE usuarios
           SET email = ?, nome = ?, atualizado_em = datetime('now','localtime')
           WHERE google_id = ?`,
          [userInfo.email, userInfo.name, userInfo.id]
        );
      }
    } else {
      db.run(
        `INSERT INTO usuarios (google_id, email, nome, refresh_token_enc)
         VALUES (?, ?, ?, ?)`,
        [userInfo.id, userInfo.email, userInfo.name, encryptedToken]
      );
    }

    const user = db.get(
      'SELECT id, email, nome FROM usuarios WHERE google_id = ?',
      [userInfo.id]
    );

    req.session.userId = user.id;
    req.session.email  = user.email;
    req.session.nome   = user.nome;

    const frontendUrl = process.env.FRONTEND_URL || '';
    res.redirect(`${frontendUrl}/?auth=success`);
  } catch (err) {
    console.error('[auth] callback error:', err.message);
    res.redirect('/?auth_error=callback_failed');
  }
});

// Step 3 — logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[auth] session destroy error:', err.message);
    res.clearCookie('floripa.sid');
    res.redirect('/');
  });
});

// GET /api/auth/me — used by frontend to determine login state on page load
// Returns current user data (200) or 401 when not authenticated.
// Mounted at /api/auth in app.js so the full path is /api/auth/me.
router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  const db = getDb();
  const usuario = db.get(
    `SELECT calendar_connected, calendar_disconnected, alert_threshold FROM usuarios WHERE id = ?`,
    [req.session.userId]
  );

  res.json({
    id:                    req.session.userId,
    email:                 req.session.email,
    nome:                  req.session.nome,
    calendar_connected:    usuario?.calendar_connected    ?? 0,
    calendar_disconnected: usuario?.calendar_disconnected ?? 0,
    alert_threshold:       usuario?.alert_threshold       ?? 51,
  });
});

module.exports = router;
