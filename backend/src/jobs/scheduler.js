'use strict';
// scheduler.js
// Inicializa jobs cron para atualização periódica de dados.
// PREV-02: Forecast nunca é buscado em request de usuário — apenas pelo scheduler.

const cron = require('node-cron');
const { fetchAndCacheForecasts } = require('../services/forecastService');

/**
 * Inicia todos os jobs agendados.
 * Chamado uma única vez em app.js na inicialização.
 */
function startScheduler() {
  // Busca previsão todo início de hora (PREV-03: atualização automática a cada 1h)
  cron.schedule('0 * * * *', async () => {
    console.log('[scheduler] Iniciando atualização de forecast...');
    await fetchAndCacheForecasts();
  });

  // Executar imediatamente na inicialização para popular o cache antes do primeiro request
  fetchAndCacheForecasts().catch(err =>
    console.error('[scheduler] Erro na busca inicial de forecast:', err.message)
  );

  console.log('[scheduler] Jobs iniciados. Forecast será atualizado a cada hora.');
}

module.exports = { startScheduler };
