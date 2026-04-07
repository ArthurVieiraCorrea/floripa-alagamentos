'use strict';
// scheduler.js
// Inicializa o job cron de previsão meteorológica.
// PREV-03: executa fetchAndCacheForecasts() automaticamente a cada 1h.
// Padrão singleton: guard 'initialized' previne double-scheduling.

const cron = require('node-cron');
const { fetchAndCacheForecasts } = require('../services/forecastService');

let initialized = false;

/**
 * Inicializa o scheduler de forecast.
 * Deve ser chamado APÓS initSchema() ter rodado (i.e., após app.use(session(...))).
 * Roda fetchAndCacheForecasts() imediatamente no startup para warm-up do cache.
 */
function initScheduler() {
  if (initialized) {
    console.warn('[scheduler] Já inicializado — ignorando chamada duplicada');
    return;
  }
  initialized = true;

  // '0 * * * *' = ao minuto 0 de cada hora (expressão cron de 5 campos)
  cron.schedule('0 * * * *', async () => {
    console.log('[scheduler] Executando fetch horário de previsão');
    await fetchAndCacheForecasts();
  }, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('[scheduler] Job de previsão agendado (a cada hora em :00)');

  // Warm-up: executar imediatamente no startup para que o cache esteja disponível
  // antes da primeira requisição. Fire-and-forget (sem await) — app.listen não bloqueia.
  fetchAndCacheForecasts().catch(err =>
    console.error('[scheduler] Warm-up inicial falhou (cache permanece stale):', err.message)
  );
}

module.exports = { initScheduler };
