const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

export const getAvistamientos   = ()       => request('/avistamientos')
export const getAvistamiento    = (id)     => request(`/avistamientos/${id}`)
export const createAvistamiento = (data)   => request('/avistamientos', { method: 'POST', body: JSON.stringify(data) })
export const updateAvistamiento = (id, d)  => request(`/avistamientos/${id}`, { method: 'PUT',  body: JSON.stringify(d) })
export const deleteAvistamiento = (id)     => request(`/avistamientos/${id}`, { method: 'DELETE' })
