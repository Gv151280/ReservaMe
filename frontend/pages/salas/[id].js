import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../lib/api';
import { todayISO, sumarDias, fmtFechaLarga, minutesToHHMM } from '../../lib/dates';
import StickerIcon, { GLYPH } from '../../components/StickerIcon';

const TONOS_POR_NOMBRE = { 'Sala de Proyectos': 'blue', CRA: 'green' };
const GLYPH_POR_NOMBRE = { 'Sala de Proyectos': GLYPH.proyector, CRA: GLYPH.libro };

export default function DetalleSala() {
  const router = useRouter();
  const { id } = router.query;

  const [sala, setSala] = useState(null);
  const [fecha, setFecha] = useState(todayISO(0));
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get('/salas').then((d) => {
      const encontrada = d.salas.find((s) => s.id === id);
      setSala(encontrada || null);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setError(null);
    api
      .get(`/salas/${id}/disponibilidad?fecha=${fecha}`)
      .then(setDisponibilidad)
      .catch((e) => setError(e.message));
  }, [id, fecha]);

  function cambiarFecha(delta) {
    const nueva = sumarDias(fecha, delta);
    if (nueva < todayISO(0) || nueva > todayISO(30)) return;
    setFecha(nueva);
  }

  if (!sala) return <p className="page-sub">Cargando sala…</p>;

  const tono = TONOS_POR_NOMBRE[sala.nombre] || 'purple';
  const glyph = GLYPH_POR_NOMBRE[sala.nombre] || GLYPH.calendario;

  return (
    <div>
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, display: 'inline-flex' }}>
        ← Volver
      </Link>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <StickerIcon tono={tono} glyph={glyph} size={60} />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{sala.nombre}</h1>
          <p className="page-sub" style={{ margin: '2px 0 0' }}>Capacidad {sala.capacidad ?? '—'} personas</p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--gray-dark)', background: 'var(--gray-light)', padding: '10px 12px', borderRadius: 12, marginBottom: 16 }}>
        🧰 {sala.equipamiento || 'Sin equipamiento registrado'}
      </p>

      <div className="calendar-row">
        <button onClick={() => cambiarFecha(-1)}>‹</button>
        <div className="calendar-date">{fmtFechaLarga(fecha)}</div>
        <button onClick={() => cambiarFecha(1)}>›</button>
      </div>

      {error && (
        <p className="hint" style={{ color: 'var(--coral-dark)' }}>No se pudo cargar la disponibilidad. {error}</p>
      )}

      {disponibilidad && !disponibilidad.abierto && (
        <div className="empty-state">
          <div className="em">🌙</div>
          <p>El colegio no tiene jornada este día, no se puede reservar.</p>
        </div>
      )}

      {disponibilidad && disponibilidad.abierto && (
        <>
          <div className="section-label">Disponibilidad por bloque (clases)</div>
          <div className="bloques-grid">
            {disponibilidad.bloques.map((b, i) => {
              const cls = `bloque-chip ${b.ocupado ? 'ocupado' : ''} ${b.pasado ? 'pasado' : ''}`;
              const disponible = !b.ocupado && !b.pasado;
              return (
                <div
                  key={i}
                  className={cls}
                  onClick={() => disponible && router.push(`/reservar?salaId=${id}&fecha=${fecha}&bloque=${i}`)}
                >
                  {minutesToHHMM(b.start)}–{minutesToHHMM(b.end)}
                  <br />
                  <span style={{ fontWeight: 600, fontSize: 10.5 }}>
                    {b.pasado ? 'Pasado' : b.ocupado ? 'Ocupado' : 'Libre'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="hint">
            Para reuniones u otro uso, la sala se puede reservar con horario libre hasta las{' '}
            {minutesToHHMM(disponibilidad.horario.horaSalidaProfesores)} (hora de salida de encargados/profesores este día).
          </p>
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary btn-block" onClick={() => router.push(`/reservar?salaId=${id}&fecha=${fecha}`)}>
          Reservar esta sala
        </button>
      </div>
    </div>
  );
}
