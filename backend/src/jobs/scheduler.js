'use strict';
// scheduler.js
// Inicializa os jobs cron de previsão meteorológica e motor de risco.
// PREV-03: executa fetchAndCacheForecasts() automaticamente a cada 1h.
// RISCO-03: recalcula risk scores a cada 4h (offset 5min garante forecast atualizado).
// Padrão singleton: guard 'initialized' previne double-scheduling.

const cron = require('node-cron');
const { fetchAndCacheForecasts } = require('../services/forecastService');
const { calcularRiscos } = require('../services/riskEngine');

let initialized = false;

/**
 * Inicializa o scheduler de forecast e risco.
 * Deve ser chamado APÓS initSchema() ter rodado (i.e., após app.use(session(...))).
 * Roda fetchAndCacheForecasts() + calcularRiscos() imediatamente no startup (encadeado).
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

  // RISCO-03: recalcular scores a cada 4h (offset de 5min garante forecast já atualizado)
  cron.schedule('5 */4 * * *', async () => {
    console.log('[scheduler] Recalculando risk scores...');
    await calcularRiscos();
  });

  console.log('[scheduler] Jobs iniciados. Forecast: 0 * * * * | Risco: 5 */4 * * *');

  // Executar imediatamente na inicialização — encadeado para garantir ordem:
  // forecast primeiro, depois risco (evita calcularRiscos com cache vazio)
  (async () => {
    try {
      await fetchAndCacheForecasts();
    } catch (err) {
      console.error('[scheduler] Erro na busca inicial de forecast:', err.message);
    }
    try {
      await calcularRiscos();
    } catch (err) {
      console.error('[scheduler] Erro no cálculo inicial de risco:', err.message);
    }
  })();
}

module.exports = { initScheduler };
