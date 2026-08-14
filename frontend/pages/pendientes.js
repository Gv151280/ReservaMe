import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { fmtFechaLarga, fmtHora } from '../lib/dates';
import Badge from '../components/Badge';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fechaISODe(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Pendientes() {
  const { showToast } = useToast();
  const [reservas, setReservas] = useState(null);
  const [rechazoId, setRechazoId] = useState(null);
  const [motivo, setMotivo] = useState('');

  function cargar() {
    api.get('/reservas/pendientes').then((d) => setReservas(d.reservas)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function aprobar(id) {
    try {
      await api.patch(`/reservas/${id}/aprobar`);
      showToast('Reserva aprobada.', 'success');
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function confirmarRechazo() {
    try {
      await api.patch(`/reservas/${rechazoId}/rechazar`, { motivo: motivo.trim() || undefined });
      showToast('Reserva rechazada.', 'info');
      setRechazoId(null);
      setMotivo('');
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (reservas === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Reservas pendientes</h1>
      <p className="page-sub">Aprueba o rechaza las solicitudes de las salas a tu cargo.</p>

      {reservas.length === 0 ? (
        <div className="empty-state">
          <div className="em">✅</div>
          <p>No hay solicitudes pendientes por ahora.</p>
        </div>
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
              <Badge tipo={r.tipoUso} />
            </div>
            <div className="reserva-actions">
              <button className="btn btn-green btn-sm" onClick={() => aprobar(r.id)}>✓ Aprobar</button>
              <button className="btn btn-coral btn-sm" onClick={() => setRechazoId(r.id)}>✕ Rechazar</button>
            </div>
          </div>
        ))
      )}

      {rechazoId && (
        <div className="overlay center">
          <div className="modal">
            <button className="modal-close-x" onClick={() => setRechazoId(null)}>✕</button>
            <div className="icon-circle" style={{ background: 'var(--coral-light)' }}>✋</div>
            <h2>Rechazar solicitud</h2>
            <p>Puedes indicar un motivo opcional para quien reservó.</p>
            <div className="field" style={{ textAlign: 'left' }}>
              <input
                type="text"
                placeholder="Ej: sala reservada para taller institucional"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-coral-solid btn-block" onClick={confirmarRechazo}>Rechazar reserva</button>
              <button className="btn btn-ghost btn-block" onClick={() => setRechazoId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
