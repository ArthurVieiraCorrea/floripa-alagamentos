const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro || `HTTP ${res.status}`);
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
};
