'use strict';
// Seed script: insere ~85 ocorrências históricas realistas em Florianópolis (2021-2024)
// Uso: node backend/seed-historico.js
// Inserção direta no SQLite — não requer autenticação.

const path = require('path');
const { Database } = require('node-sqlite3-wasm');

const DB_PATH = path.join(__dirname, 'data/alagamentos.db');
const db = new Database(DB_PATH);

const DADOS = [
  // ── Itacorubi (planície do Rio Itacorubi — maior frequência de alagamentos)
  { bairro:'Itacorubi', lat:-27.5769, lng:-48.4999, nivel:'critico', data:'2021-01-12 16:30:00', desc:'Alagamento na Av. Admar Gonzaga — trânsito interrompido' },
  { bairro:'Itacorubi', lat:-27.5785, lng:-48.5012, nivel:'alto',    data:'2021-03-05 09:15:00', desc:'Transbordamento do Rio Itacorubi' },
  { bairro:'Itacorubi', lat:-27.5752, lng:-48.4986, nivel:'alto',    data:'2021-11-22 14:00:00', desc:'Rua Dep. Antônio Edu Vieira alagada' },
  { bairro:'Itacorubi', lat:-27.5801, lng:-48.5028, nivel:'critico', data:'2022-01-18 11:45:00', desc:'Rio transbordou — famílias evacuadas' },
  { bairro:'Itacorubi', lat:-27.5737, lng:-48.4974, nivel:'alto',    data:'2022-02-07 17:30:00', desc:'Alagamento sob o viaduto' },
  { bairro:'Itacorubi', lat:-27.5815, lng:-48.5041, nivel:'medio',   data:'2022-11-14 08:20:00', desc:'Acúmulo de água em ruas secundárias' },
  { bairro:'Itacorubi', lat:-27.5723, lng:-48.4962, nivel:'alto',    data:'2023-01-09 13:00:00', desc:'Alagamento próximo ao CIASC' },
  { bairro:'Itacorubi', lat:-27.5769, lng:-48.5015, nivel:'critico', data:'2023-02-01 19:00:00', desc:'Maior evento registrado — 120mm em 6h' },
  { bairro:'Itacorubi', lat:-27.5793, lng:-48.4988, nivel:'alto',    data:'2023-12-19 15:30:00', desc:'Transbordamento pontual' },
  { bairro:'Itacorubi', lat:-27.5745, lng:-48.5002, nivel:'medio',   data:'2024-01-25 10:00:00', desc:'Rua inundada por 3h' },
  { bairro:'Itacorubi', lat:-27.5821, lng:-48.4975, nivel:'alto',    data:'2024-02-14 16:15:00', desc:'Acesso ao Parque Estadual cortado' },
  { bairro:'Itacorubi', lat:-27.5758, lng:-48.5033, nivel:'critico', data:'2024-03-03 12:30:00', desc:'Terceiro maior evento em 12 meses' },

  // ── Saco dos Limões (ponto de cheia recorrente na parte sul do Centro)
  { bairro:'Saco dos Limões', lat:-27.6068, lng:-48.5288, nivel:'critico', data:'2021-01-29 15:00:00', desc:'Av. Mauro Ramos completamente alagada' },
  { bairro:'Saco dos Limões', lat:-27.6082, lng:-48.5275, nivel:'alto',    data:'2021-02-11 18:30:00', desc:'Ruas do bairro intransitáveis' },
  { bairro:'Saco dos Limões', lat:-27.6055, lng:-48.5301, nivel:'alto',    data:'2022-01-03 09:00:00', desc:'Alagamento em residências do nível baixo' },
  { bairro:'Saco dos Limões', lat:-27.6071, lng:-48.5265, nivel:'medio',   data:'2022-11-28 20:00:00', desc:'Enchente de menor porte' },
  { bairro:'Saco dos Limões', lat:-27.6090, lng:-48.5310, nivel:'critico', data:'2023-01-14 14:45:00', desc:'Registro mais severo do bairro em 2023' },
  { bairro:'Saco dos Limões', lat:-27.6046, lng:-48.5280, nivel:'alto',    data:'2023-03-21 11:00:00', desc:'Chuva contínua por 8h' },
  { bairro:'Saco dos Limões', lat:-27.6075, lng:-48.5296, nivel:'medio',   data:'2024-01-08 17:00:00', desc:'Transbordamento moderado' },
  { bairro:'Saco dos Limões', lat:-27.6062, lng:-48.5272, nivel:'alto',    data:'2024-02-22 13:30:00', desc:'Ponte de acesso interditada por 2h' },

  // ── Trindade (planície próxima à UFSC)
  { bairro:'Trindade', lat:-27.5863, lng:-48.5116, nivel:'alto',    data:'2021-02-16 12:00:00', desc:'Alagamento no entorno da UFSC' },
  { bairro:'Trindade', lat:-27.5878, lng:-48.5102, nivel:'medio',   data:'2021-12-02 16:45:00', desc:'Rua Dep. Antônio Edu Vieira alagada perto do HU' },
  { bairro:'Trindade', lat:-27.5849, lng:-48.5131, nivel:'alto',    data:'2022-02-24 10:30:00', desc:'Ciclone extratropical — transbordamento' },
  { bairro:'Trindade', lat:-27.5891, lng:-48.5088, nivel:'medio',   data:'2022-12-16 08:00:00', desc:'Acúmulo em ponto baixo' },
  { bairro:'Trindade', lat:-27.5866, lng:-48.5120, nivel:'alto',    data:'2023-02-08 19:30:00', desc:'100mm em 4h — alerta emitido' },
  { bairro:'Trindade', lat:-27.5855, lng:-48.5099, nivel:'medio',   data:'2023-11-29 15:00:00', desc:'Enchente de menor porte' },
  { bairro:'Trindade', lat:-27.5882, lng:-48.5140, nivel:'alto',    data:'2024-01-31 09:15:00', desc:'Ruas primárias intransitáveis' },
  { bairro:'Trindade', lat:-27.5843, lng:-48.5109, nivel:'medio',   data:'2024-03-09 14:00:00', desc:'Acesso lateral ao HU bloqueado' },

  // ── Centro (pontos históricos de enchente)
  { bairro:'Centro', lat:-27.5961, lng:-48.5478, nivel:'medio',   data:'2021-02-03 11:00:00', desc:'Rua Felipe Schmidt alagada' },
  { bairro:'Centro', lat:-27.5979, lng:-48.5461, nivel:'alto',    data:'2021-12-10 17:15:00', desc:'Av. Rio Branco transbordou' },
  { bairro:'Centro', lat:-27.5943, lng:-48.5495, nivel:'medio',   data:'2022-01-27 14:30:00', desc:'Enxurrada no calçadão' },
  { bairro:'Centro', lat:-27.5966, lng:-48.5442, nivel:'alto',    data:'2022-11-07 09:30:00', desc:'Bueiros entupidos — água acima do joelho' },
  { bairro:'Centro', lat:-27.5952, lng:-48.5510, nivel:'medio',   data:'2023-01-20 16:00:00', desc:'Evento moderado após 60mm' },
  { bairro:'Centro', lat:-27.5988, lng:-48.5473, nivel:'alto',    data:'2024-02-05 13:45:00', desc:'Dois pontos críticos simultâneos' },

  // ── Abraão (área de talvegue)
  { bairro:'Abraão', lat:-27.5957, lng:-48.6034, nivel:'medio',   data:'2021-03-12 10:00:00', desc:'Chuva forte após estiagem' },
  { bairro:'Abraão', lat:-27.5970, lng:-48.6020, nivel:'alto',    data:'2021-11-18 17:30:00', desc:'Rua principal bloqueada' },
  { bairro:'Abraão', lat:-27.5943, lng:-48.6049, nivel:'medio',   data:'2022-02-02 12:15:00', desc:'Acúmulo por 4h' },
  { bairro:'Abraão', lat:-27.5961, lng:-48.6060, nivel:'alto',    data:'2022-12-20 18:00:00', desc:'Transbordamento em ponto baixo' },
  { bairro:'Abraão', lat:-27.5978, lng:-48.6038, nivel:'medio',   data:'2023-01-16 08:30:00', desc:'Nível moderado' },
  { bairro:'Abraão', lat:-27.5949, lng:-48.6025, nivel:'alto',    data:'2024-01-29 15:00:00', desc:'Enchente após 80mm em 3h' },

  // ── Capoeiras
  { bairro:'Capoeiras', lat:-27.5901, lng:-48.6110, nivel:'medio',   data:'2021-02-25 09:00:00', desc:'Ruas do setor sul alagadas' },
  { bairro:'Capoeiras', lat:-27.5915, lng:-48.6097, nivel:'alto',    data:'2021-12-07 16:00:00', desc:'Alagamento extenso — 2km de via afetada' },
  { bairro:'Capoeiras', lat:-27.5888, lng:-48.6124, nivel:'medio',   data:'2022-03-01 11:30:00', desc:'Evento de menor intensidade' },
  { bairro:'Capoeiras', lat:-27.5904, lng:-48.6082, nivel:'alto',    data:'2023-02-13 14:00:00', desc:'Ciclone: nível mais alto em 5 anos' },
  { bairro:'Capoeiras', lat:-27.5920, lng:-48.6115, nivel:'medio',   data:'2023-11-25 10:45:00', desc:'Acúmulo em trecho baixo' },
  { bairro:'Capoeiras', lat:-27.5893, lng:-48.6101, nivel:'alto',    data:'2024-02-18 17:30:00', desc:'Rua de acesso principal bloqueada' },

  // ── Estreito
  { bairro:'Estreito', lat:-27.5900, lng:-48.6250, nivel:'medio',   data:'2021-01-20 13:00:00', desc:'Enchente leve próxima à BR-282' },
  { bairro:'Estreito', lat:-27.5914, lng:-48.6237, nivel:'alto',    data:'2022-02-19 15:45:00', desc:'Alagamento sob o viaduto' },
  { bairro:'Estreito', lat:-27.5886, lng:-48.6263, nivel:'medio',   data:'2022-12-04 09:15:00', desc:'Ponto baixo da Av. Ivo Silveira' },
  { bairro:'Estreito', lat:-27.5903, lng:-48.6274, nivel:'alto',    data:'2023-03-11 18:30:00', desc:'Ciclone — maior evento do bairro' },
  { bairro:'Estreito', lat:-27.5928, lng:-48.6244, nivel:'medio',   data:'2024-01-14 11:00:00', desc:'Acúmulo por 2h' },

  // ── Monte Cristo (encosta + planície)
  { bairro:'Monte Cristo', lat:-27.5636, lng:-48.6326, nivel:'medio',   data:'2021-03-03 14:00:00', desc:'Acúmulo em rua principal' },
  { bairro:'Monte Cristo', lat:-27.5650, lng:-48.6312, nivel:'alto',    data:'2022-01-15 10:30:00', desc:'Enxurrada na descida da encosta' },
  { bairro:'Monte Cristo', lat:-27.5622, lng:-48.6340, nivel:'medio',   data:'2023-02-25 16:00:00', desc:'Nível moderado após tempestade' },
  { bairro:'Monte Cristo', lat:-27.5643, lng:-48.6298, nivel:'alto',    data:'2024-03-07 12:45:00', desc:'Erosão + alagamento simultâneos' },

  // ── Coqueiros (aterro à beira-mar)
  { bairro:'Coqueiros', lat:-27.5773, lng:-48.6155, nivel:'medio',   data:'2021-02-08 17:00:00', desc:'Ressaca agravou alagamento na orla' },
  { bairro:'Coqueiros', lat:-27.5789, lng:-48.6140, nivel:'alto',    data:'2022-11-30 13:30:00', desc:'Combinação de chuva e maré alta' },
  { bairro:'Coqueiros', lat:-27.5759, lng:-48.6172, nivel:'medio',   data:'2023-12-05 09:00:00', desc:'Acúmulo moderado' },
  { bairro:'Coqueiros', lat:-27.5778, lng:-48.6163, nivel:'alto',    data:'2024-02-09 16:00:00', desc:'Av. Beira Mar alagada por 3h' },

  // ── Córrego Grande
  { bairro:'Córrego Grande', lat:-27.5877, lng:-48.4892, nivel:'baixo',   data:'2021-11-10 11:00:00', desc:'Micro-alagamento em via secundária' },
  { bairro:'Córrego Grande', lat:-27.5891, lng:-48.4878, nivel:'medio',   data:'2022-02-28 14:15:00', desc:'Rua bloqueada por 1h' },
  { bairro:'Córrego Grande', lat:-27.5863, lng:-48.4905, nivel:'baixo',   data:'2023-01-03 08:30:00', desc:'Acúmulo leve' },
  { bairro:'Córrego Grande', lat:-27.5880, lng:-48.4915, nivel:'medio',   data:'2024-01-19 12:00:00', desc:'Evento moderado' },

  // ── Pantanal
  { bairro:'Pantanal', lat:-27.5972, lng:-48.5111, nivel:'baixo',   data:'2021-12-17 15:30:00', desc:'Acúmulo em cruzamento' },
  { bairro:'Pantanal', lat:-27.5986, lng:-48.5098, nivel:'medio',   data:'2022-03-08 10:00:00', desc:'Rua lateral alagada' },
  { bairro:'Pantanal', lat:-27.5958, lng:-48.5125, nivel:'baixo',   data:'2023-11-21 17:00:00', desc:'Evento de baixo impacto' },
  { bairro:'Pantanal', lat:-27.5975, lng:-48.5139, nivel:'medio',   data:'2024-02-28 09:45:00', desc:'Acúmulo por 2h' },

  // ── Agronômica
  { bairro:'Agronômica', lat:-27.5897, lng:-48.5363, nivel:'medio',   data:'2022-01-10 16:00:00', desc:'Alagamento em ponto baixo' },
  { bairro:'Agronômica', lat:-27.5910, lng:-48.5349, nivel:'alto',    data:'2023-02-17 11:30:00', desc:'Rua Madre Benvenuta interditada' },
  { bairro:'Agronômica', lat:-27.5884, lng:-48.5377, nivel:'medio',   data:'2024-01-22 13:15:00', desc:'Evento moderado' },

  // ── Santa Mônica
  { bairro:'Santa Mônica', lat:-27.5910, lng:-48.4932, nivel:'baixo',   data:'2022-12-12 14:00:00', desc:'Acúmulo leve' },
  { bairro:'Santa Mônica', lat:-27.5924, lng:-48.4918, nivel:'medio',   data:'2023-12-28 10:30:00', desc:'Rua secundária bloqueada' },
  { bairro:'Santa Mônica', lat:-27.5898, lng:-48.4946, nivel:'baixo',   data:'2024-03-15 15:00:00', desc:'Evento passageiro' },
];

const stmt = db.prepare(
  `INSERT OR IGNORE INTO ocorrencias (latitude, longitude, bairro, nivel, descricao, fonte, criado_em, atualizado_em)
   VALUES (?, ?, ?, ?, ?, 'historico', ?, ?)`
);

let inseridos = 0;
let ignorados = 0;

for (const d of DADOS) {
  try {
    stmt.run([d.lat, d.lng, d.bairro, d.nivel, d.desc, d.data, d.data]);
    inseridos++;
  } catch (err) {
    console.warn(`Ignorado (${d.bairro} ${d.data}): ${err.message}`);
    ignorados++;
  }
}

stmt.finalize();
db.close();

console.log(`✅ Seed concluído: ${inseridos} inseridos, ${ignorados} ignorados`);
console.log('Execute node backend/src/services/riskEngine.js ou reinicie o backend para recalcular riscos.');
