const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    // sin cuerpo JSON (ej. 204)
  }

  if (!res.ok) {
    const mensaje = (data && data.error) || `Error ${res.status}`;
    throw new Error(mensaje);
  }
  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
};

export { API_URL };
