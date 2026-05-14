const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, options = {}) {
  const response = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    let detail
    try { detail = (await response.json()).detail } catch { detail = response.statusText }
    throw new Error(detail || `HTTP ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  listar:     ()         => apiFetch('/avistamientos'),
  crear:      (data)     => apiFetch('/avistamientos', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id, data) => apiFetch(`/avistamientos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminar:   (id)       => apiFetch(`/avistamientos/${id}`, { method: 'DELETE' }),
}
