import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://reservame-backend.onrender.com';
const REFRESCO_MS = 60000; // 1 minuto

export default function EstadoSalaPublico() {
  const router = useRouter();
  const { id } = router.query;
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    if (!id) return;
    fetch(`${API_BASE}/salas/${id}/estado-publico`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo cargar el estado de la sala.');
        }
        return res.json();
      })
      .then((data) => {
        setEstado(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const estiloBase = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
    fontFamily: 'inherit',
  };

  if (error) {
    return (
      <div style={estiloBase}>
        <p style={{ fontSize: 18, color: 'var(--coral-dark, #b33)' }}>{error}</p>
      </div>
    );
  }

  if (!estado) {
    return (
      <div style={estiloBase}>
        <p style={{ fontSize: 18, color: 'var(--gray, #888)' }}>Cargando…</p>
      </div>
    );
  }

  const ocupada = estado.ocupada;

  return (
    <div
      style={{
        ...estiloBase,
        background: ocupada ? 'var(--coral-light, #fbe2de)' : '#e3f6e8',
      }}
    >
      <div style={{ fontSize: 15, color: 'var(--gray-dark, #555)', marginBottom: 6 }}>
        {estado.colegio} · {estado.sala}
      </div>
      <div style={{ fontSize: 42, fontWeight: 800, color: ocupada ? 'var(--coral-dark, #b33)' : '#1a7a3c' }}>
        {ocupada ? 'Ocupada' : 'Libre'}
      </div>
      <div style={{ fontSize: 18, marginTop: 10, color: 'var(--gray-dark, #555)' }}>
        {ocupada
          ? `Hasta las ${estado.hasta}`
          : estado.libreHasta
          ? `Hasta las ${estado.libreHasta}`
          : 'El resto del día'}
      </div>
      <div style={{ fontSize: 12, marginTop: 24, color: 'var(--gray, #999)' }}>
        Se actualiza automáticamente
      </div>
    </div>
  );
}
