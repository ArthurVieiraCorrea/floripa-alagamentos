'use strict';
// constants/bairros.js
// Lista canônica de ~50 bairros oficiais de Florianópolis.
// Compartilhado entre riskEngine.js e calendarService.js.
// Fonte: Wikipedia — Lista de distritos e bairros de Florianópolis

const BAIRROS_FLORIANOPOLIS = [
  // Ilha — Norte
  'Canasvieiras', 'Jurerê', 'Daniela', 'Ponta das Canas', 'Cachoeira do Bom Jesus',
  'Ingleses', 'Santinho', 'Rio Vermelho', 'Vargem Grande', 'Vargem Pequena',
  // Ilha — Leste
  'Barra da Lagoa', 'Lagoa da Conceição', 'Praia Mole', 'São João do Rio Vermelho',
  // Ilha — Sul
  'Campeche', 'Morro das Pedras', 'Armação', 'Pântano do Sul', 'Ribeirão da Ilha',
  'Tapera', 'Carianos', 'Costeira do Pirajubaé', 'Saco dos Limões',
  // Ilha — Central/Leste
  'Rio Tavares', 'Itacorubi', 'Trindade', 'Córrego Grande', 'Santa Mônica',
  'Pantanal', 'Serrinha',
  // Ilha — Central
  'Centro', 'Agronômica', 'José Mendes', 'Saco Grande', 'João Paulo',
  'Santo Antônio de Lisboa', 'Ratones', 'Sambaqui', 'Cacupé',
  // Continental
  'Estreito', 'Capoeiras', 'Coqueiros', 'Abraão', 'Balneário', 'Coloninha',
  'Monte Cristo', 'Jardim Atlântico', 'Itaguaçu', 'Bom Abrigo', 'Bela Vista',
];

/**
 * Normaliza nome de bairro para comparação tolerante a acentos e capitalização.
 * Ex: "Agronômica" → "agronomica"
 * @param {string} nome
 * @returns {string}
 */
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

module.exports = { BAIRROS_FLORIANOPOLIS, normalizarNome };
