/* global L */
// controles.js
// D-03: Toggle Risco/Ocorrências — L.Control, topleft, default Risco
// D-04: Modo exclusivo — sem estado misto choropleth + marcadores
// D-05: Seletor 24h/48h/72h — L.Control, topleft, default 24h
// D-06: Troca de horizonte re-requisita API e re-renderiza choropleth
// D-08: Timestamp de atualização abaixo do seletor de horizonte

/**
 * Cria o controle de toggle Risco / Ocorrências.
 * Posição: topleft, abaixo do zoom nativo.
 *
 * @param {{ onModoChange: (modo: 'risco'|'ocorrencias') => void }} opts
 * @returns {L.Control}
 */
export function criarControleToggle({ onModoChange }) {
  const ControleToggle = L.Control.extend({
    options: { position: 'topleft' },

    onAdd(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control controle-toggle');
      // CRÍTICO: impede que cliques no controle propaguem para o mapa
      // Sem isso, clicar em botões dispara map.on('click') e cria tempMarker
      L.DomEvent.disableClickPropagation(container);

      this._btnRisco = L.DomUtil.create('button', 'btn-modo ativo', container);
      this._btnRisco.textContent = 'Risco';
      this._btnRisco.type = 'button';

      this._btnOcorrencias = L.DomUtil.create('button', 'btn-modo', container);
      this._btnOcorrencias.textContent = 'Ocorrências';
      this._btnOcorrencias.type = 'button';

      L.DomEvent.on(this._btnRisco, 'click', () => this._ativar('risco'));
      L.DomEvent.on(this._btnOcorrencias, 'click', () => this._ativar('ocorrencias'));

      return container;
    },

    onRemove() {
      if (this._btnRisco)       L.DomEvent.off(this._btnRisco);
      if (this._btnOcorrencias) L.DomEvent.off(this._btnOcorrencias);
    },

    _ativar(modo) {
      // Update button active states
      this._btnRisco.classList.toggle('ativo', modo === 'risco');
      this._btnOcorrencias.classList.toggle('ativo', modo === 'ocorrencias');
      // Notify main.js — main.js handles layer management
      onModoChange(modo);
    }
  });

  return new ControleToggle();
}

/**
 * Cria o controle de seleção de horizonte temporal (24h / 48h / 72h).
 * Posição: topleft, abaixo do toggle Risco/Ocorrências.
 * Inclui linha de timestamp abaixo dos botões (D-08).
 *
 * @param {{
 *   onHorizonteChange: (window: 24|48|72) => void,
 *   horizonteInicial?: 24|48|72
 * }} opts
 * @returns {{ controle: L.Control, atualizarTimestamp: (texto: string) => void }}
 */
export function criarControleSeletor({ onHorizonteChange, horizonteInicial = 24 }) {
  let _atualizarTimestampFn = null;

  const ControleSeletor = L.Control.extend({
    options: { position: 'topleft' },

    onAdd(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control controle-horizonte-wrapper');
      L.DomEvent.disableClickPropagation(container);

      // Linha de botões de horizonte
      const botoesDiv = L.DomUtil.create('div', 'controle-horizonte', container);

      this._btns = {};
      [24, 48, 72].forEach(h => {
        const btn = L.DomUtil.create('button', 'btn-horizonte', botoesDiv);
        btn.textContent = `${h}h`;
        btn.type = 'button';
        if (h === horizonteInicial) btn.classList.add('ativo');
        this._btns[h] = btn;
        L.DomEvent.on(btn, 'click', () => this._selecionarHorizonte(h));
      });

      // Linha de timestamp (D-08) — abaixo dos botões
      this._timestamp = L.DomUtil.create('div', 'controle-timestamp', container);
      this._timestamp.textContent = 'Calculando...';

      // Expor função de atualização para chamadores externos
      _atualizarTimestampFn = (texto) => {
        if (this._timestamp) this._timestamp.textContent = texto;
      };

      return container;
    },

    onRemove() {
      [24, 48, 72].forEach(h => {
        if (this._btns[h]) L.DomEvent.off(this._btns[h]);
      });
      _atualizarTimestampFn = null;
    },

    _selecionarHorizonte(window) {
      // Atualizar estado visual dos botões
      Object.entries(this._btns).forEach(([h, btn]) => {
        btn.classList.toggle('ativo', parseInt(h) === window);
      });
      // Notificar main.js
      onHorizonteChange(window);
    }
  });

  const controle = new ControleSeletor();

  // Retorna tanto o controle quanto a função de atualização de timestamp
  // main.js chama atualizarTimestamp('Atualizado: HH:MM') após carregar dados
  return {
    controle,
    atualizarTimestamp: (texto) => {
      if (_atualizarTimestampFn) _atualizarTimestampFn(texto);
    }
  };
}
