// Fail fast if required env vars are missing — prevents silent failures mid-request.
const REQUIRED_ENV = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.ENCRYPTION_KEY.length !== 64) {
  console.error('[startup] ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const session      = require('express-session');
const WasmSQLiteStore = require('./middleware/session');
const authRouter   = require('./routes/auth');

const ocorrenciasRouter = require('./routes/ocorrencias');
const previsaoRouter    = require('./routes/previsao');
const riscoRouter       = require('./routes/risco');
const calendarRouter    = require('./routes/calendar');
const pushRouter        = require('./routes/push');
const alertasRouter     = require('./routes/alertas');
const { initScheduler } = require('./jobs/scheduler');

const webpush = require('web-push');
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@example.com'}`,
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use(session({
  store: new WasmSQLiteStore(),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod; http in dev
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  name: 'floripa.sid', // custom name reduces fingerprinting vs default 'connect.sid'
}));

app.use('/auth',      authRouter);   // Google OAuth flow (/auth/google, /auth/google/callback, /auth/logout)
app.use('/api/auth',  authRouter);   // REST endpoint (/api/auth/me) — same router, two mount points

// Rotas da API
app.use('/api/ocorrencias', ocorrenciasRouter);
app.use('/api/previsao',    previsaoRouter);
app.use('/api/risco',       riscoRouter);
app.use('/api/calendar',    calendarRouter);
app.use('/api/push',        pushRouter);
app.use('/api/alertas',     alertasRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve o frontend em produção
const frontendDist = path.join(__dirname, '../../frontend/dist');
const fs = require('fs');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ erro: 'Frontend não compilado. Execute: cd frontend && npm run build' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Inicializa scheduler de previsão meteorológica APÓS session middleware (initSchema já rodou)
initScheduler();

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;
