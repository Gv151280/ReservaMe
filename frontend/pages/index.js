import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/useSession';
import SalaCard from '../components/SalaCard';

export default function Inicio() {
  const { user } = useSession();
  const [salas, setSalas] = useState(null);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    api
      .get('/salas')
      .then((d) => setSalas(d.salas))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Hola, {user?.nombre?.split(' ')[0]} 👋</h1>
      <p className="page-sub">Elige una sala para ver disponibilidad y reservar.</p>

      {showOnboarding && (
        <div className="banner">
          <button className="x" onClick={() => setShowOnboarding(false)}>✕</button>
          <b>¿Primera vez aquí?</b>
          <p>Toca una sala → elige fecha y bloque → confirma. Menos de 30 segundos.</p>
        </div>
      )}

      {error && (
        <p className="hint" style={{ color: 'var(--coral-dark)' }}>
          No se pudo conectar con el servidor. Inténtalo de nuevo. ({error})
        </p>
      )}

      {salas === null && !error && <p className="page-sub">Cargando salas…</p>}

      {salas && salas.length === 0 && (
        <div className="empty-state">
          <div className="em">🏫</div>
          <p>Aún no hay salas configuradas.</p>
        </div>
      )}

      {salas && salas.map((s) => <SalaCard key={s.id} sala={s} />)}
    </div>
  );
}
