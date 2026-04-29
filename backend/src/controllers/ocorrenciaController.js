const OcorrenciaModel = require('../models/ocorrencia');
const { getDb } = require('../config/database');

const NIVEL_PESO = { baixo: 0.3, medio: 0.5, alto: 0.8, critico: 1.0 };

const NIVEIS_VALIDOS = ['baixo', 'medio', 'alto', 'critico'];

function validarOcorrencia({ latitude, longitude, bairro, nivel }) {
  const erros = [];
  if (latitude == null || isNaN(latitude) || latitude < -90 || latitude > 90)
    erros.push('latitude inválida');
  if (longitude == null || isNaN(longitude) || longitude < -180 || longitude > 180)
    erros.push('longitude inválida');
  if (!bairro || bairro.trim().length < 2)
    erros.push('bairro é obrigatório');
  if (!NIVEIS_VALIDOS.includes(nivel))
    erros.push(`nivel deve ser um de: ${NIVEIS_VALIDOS.join(', ')}`);
  return erros;
}

const OcorrenciaController = {
  criar(req, res) {
    const { latitude, longitude, bairro, nivel, descricao, fonte } = req.body;
    const erros = validarOcorrencia({ latitude, longitude, bairro, nivel });
    if (erros.length) return res.status(400).json({ erro: erros.join('; ') });

    try {
      const ocorrencia = OcorrenciaModel.create({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        bairro: bairro.trim(),
        nivel,
        descricao: descricao?.trim(),
        fonte
      });
      res.status(201).json(ocorrencia);
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao registrar ocorrência' });
    }
  },

  listar(req, res) {
    const { nivel, bairro, de, ate, pagina = 1, limite = 50 } = req.query;
    const pag = Math.max(1, parseInt(pagina));
    const lim = Math.min(200, Math.max(1, parseInt(limite)));
    const offset = (pag - 1) * lim;

    try {
      const filtros = { nivel, bairro, de, ate, limite: lim, offset };
      const dados = OcorrenciaModel.findAll(filtros);
      const total = OcorrenciaModel.count({ nivel, bairro, de, ate });
      res.json({
        dados,
        paginacao: { total, pagina: pag, limite: lim, paginas: Math.ceil(total / lim) }
      });
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao listar ocorrências' });
    }
  },

  recentes(req, res) {
    const horas = Math.min(168, Math.max(1, parseInt(req.query.horas) || 24));
    try {
      res.json(OcorrenciaModel.findRecentes(horas));
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao buscar ocorrências recentes' });
    }
  },

  estatisticas(req, res) {
    try {
      res.json(OcorrenciaModel.estatisticas());
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao calcular estatísticas' });
    }
  },

  buscarPorId(req, res) {
    const ocorrencia = OcorrenciaModel.findById(parseInt(req.params.id));
    if (!ocorrencia) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.json(ocorrencia);
  },

  deletar(req, res) {
    const removido = OcorrenciaModel.delete(parseInt(req.params.id));
    if (!removido) return res.status(404).json({ erro: 'Ocorrência não encontrada' });
    res.status(204).end();
  },

  heatmap(req, res) {
    try {
      const rows = getDb().all('SELECT latitude, longitude, nivel, bairro FROM ocorrencias');
      const pontos = rows.map(r => ({
        lat: r.latitude, lng: r.longitude, weight: NIVEL_PESO[r.nivel] ?? 0.5
      }));
      const contagem = {};
      for (const r of rows) contagem[r.bairro] = (contagem[r.bairro] || 0) + 1;
      const bairros = Object.entries(contagem)
        .map(([bairro, count]) => ({ bairro, count }))
        .sort((a, b) => b.count - a.count);
      res.json({ pontos, bairros, total: rows.length });
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao gerar dados de heatmap' });
    }
  }
};

module.exports = OcorrenciaController;
