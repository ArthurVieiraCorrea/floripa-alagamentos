'use strict';
// Middleware: blocks requests without an authenticated session.
// Applied only to routes that require login (currently: DELETE /api/ocorrencias/:id).
// Do NOT apply at router level or globally — POST /api/ocorrencias must remain public (AUTH-04).

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ erro: 'Autenticação necessária' });
  }
  next();
}

module.exports = { requireAuth };
