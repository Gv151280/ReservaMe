import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import Badge from '../components/Badge';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fechaISODe(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const texto = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function fmtHora(iso) {
  const d = new Date(iso);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export default function TodasLasReservas() {
  const { showToast } = useToast();
  const [reservas, setReservas] = useState(null);
  const [confirmarId, setConfirmarId] = useState(null);

  function cargar() {
    api.get('/reservas/todas').then((d) => setReservas(d.reservas)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function anular(id) {
    try {
      await api.del(`/reservas/${id}`);
      showToast('Reserva anulada.', 'info');
      setConfirmarId(null);
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (reservas === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Todas las reservas</h1>
      <p className="page-sub">Puedes anular la reserva de cualquier docente, en cualquier sala.</p>

      {reservas.length === 0 ? (
        <div className="empty-state"><div className="em">📭</div><p>No hay reservas activas.</p></div>
      ) : (
        reservas.map((r) => (
          <div className="reserva-item" key={r.id}>
            <div className="reserva-top">
              <div>
                <div className="reserva-sala">{r.sala.nombre}</div>
                <div className="reserva-meta">
                  {r.usuario.nombre} · {fmtFechaLarga(fechaISODe(r.fechaInicio))} · {fmtHora(r.fechaInicio)}–{fmtHora(r.fechaFin)}
                </div>
              </div>
              <Badge tipo={r.estado} />
            </div>
            <Badge tipo={r.tipoUso} />
            <div className="reserva-actions">
              <button className="btn btn-coral btn-sm" onClick={() => setConfirmarId(r.id)}>Anular reserva</button>
            </div>
          </div>
        ))
      )}

      {confirmarId && (
        <div className="overlay center">
          <div className="modal">
            <div className="icon-circle" style={{ background: 'var(--coral-light)' }}>🗑️</div>
            <h2>¿Anular esta reserva?</h2>
            <p>El docente será notificado. Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-coral-solid btn-block" onClick={() => anular(confirmarId)}>Sí, anular</button>
              <button className="btn btn-ghost btn-block" onClick={() => setConfirmarId(null)}>Volver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
