const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.erro || `HTTP ${res.status}`), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  criarOcorrencia: (data) =>
    request('/ocorrencias', { method: 'POST', body: JSON.stringify(data) }),

  listarOcorrencias: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )).toString();
    return request(`/ocorrencias${qs ? '?' + qs : ''}`);
  },

  ocorrenciasRecentes: (horas = 24) =>
    request(`/ocorrencias/recentes?horas=${horas}`),

  heatmapOcorrencias: () =>
    request('/ocorrencias/heatmap'),

  estatisticas: () =>
    request('/ocorrencias/stats'),

  deletarOcorrencia: (id) =>
    request(`/ocorrencias/${id}`, { method: 'DELETE' }),

  // Returns current user { id, email, nome } or null when not authenticated.
  async sessao() {
    const res = await fetch('/api/auth/me');
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  riscos: (window = 24) =>
    request(`/risco/bairros?window=${window}`),

  conectarCalendario: () =>
    request('/calendar/connect', { method: 'POST' }),

  desconectarCalendario: () =>
    request('/calendar/disconnect', { method: 'DELETE' }),

  listarEventosCalendario: () =>
    request('/calendar/eventos'),

  atualizarBairroEvento: (googleEventId, bairro) =>
    request(`/calendar/eventos/${encodeURIComponent(googleEventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ bairro }),
    }),

  push: {
    subscribe: (subscriptionJSON) =>
      request('/push/subscribe', { method: 'POST', body: JSON.stringify(subscriptionJSON) }),
    unsubscribe: (endpoint) =>
      request('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
    setThreshold: (threshold) =>
      request('/push/threshold', { method: 'PATCH', body: JSON.stringify({ threshold }) }),
    setAlertHours: (hours_before) =>
      request('/push/alert-hours', { method: 'PATCH', body: JSON.stringify({ hours_before }) }),
    getVapidPublicKey: () => request('/push/vapid-public-key'),
    sendTest: () => request('/push/test', { method: 'POST' }),
  },

  usuarios: {
    // Grava onboarding_done = 1. Chamado ao pular ou concluir o wizard (UX-04, D-06, D-07).
    setOnboardingDone: () =>
      request('/usuarios/me', { method: 'PATCH', body: JSON.stringify({ onboarding_done: 1 }) }),
  },

  alertas: {
    pendentes: () => request('/alertas/pendentes'),
    marcarVisto: (ids) =>
      request('/alertas/marcar-visto', { method: 'POST', body: JSON.stringify({ ids }) }),
    historico: (pagina = 1) => request(`/alertas/historico?pagina=${pagina}`),
  },

  admin: {
    // Envia texto CSV raw; retorna prévia sem inserir nada (HIST-01, HIST-02)
    preview: (csvText) =>
      fetch(`${BASE}/admin/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: csvText,
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(body.erro || `HTTP ${res.status}`), { status: res.status });
        return body;
      }),

    // Confirma importação das linhas aprovadas na prévia (HIST-03)
    confirmar: (linhas) =>
      request('/admin/confirmar', { method: 'POST', body: JSON.stringify({ linhas }) }),

    // Dispara recálculo imediato do motor de risco após importação
    recalcular: () =>
      request('/admin/recalcular', { method: 'POST' }),
  },

  previsao: {
    atual: () => request('/previsao/atual'),
  },
};
