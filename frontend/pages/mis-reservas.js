import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { fmtFechaLarga, fmtHora } from '../lib/dates';
import Badge from '../components/Badge';

export default function MisReservas() {
  const { showToast } = useToast();
  const [reservas, setReservas] = useState(null);
  const [tab, setTab] = useState('proximas');
  const [confirmarCancelarId, setConfirmarCancelarId] = useState(null);

  function cargar() {
    api.get('/reservas/mias').then((d) => setReservas(d.reservas)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  if (reservas === null) return <p className="page-sub">Cargando reservas…</p>;

  const ahora = new Date();
  const proximas = reservas.filter((r) => r.estado === 'confirmada' && new Date(r.fechaInicio) >= ahora);
  const pendientes = reservas.filter((r) => r.estado === 'pendiente');
  const pasadas = reservas.filter(
    (r) => (r.estado === 'confirmada' && new Date(r.fechaInicio) < ahora) || r.estado === 'cancelada' || r.estado === 'rechazada'
  );

  const listasPorTab = { proximas, pendientes, pasadas };
  let lista = [...listasPorTab[tab]];
  lista.sort((a, b) => (tab === 'pasadas' ? new Date(b.fechaInicio) - new Date(a.fechaInicio) : new Date(a.fechaInicio) - new Date(b.fechaInicio)));

  async function cancelar(id) {
    try {
      await api.del(`/reservas/${id}`);
      showToast('Reserva cancelada.', 'info');
      setConfirmarCancelarId(null);
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const emptyMsg = {
    proximas: 'No tienes reservas próximas.',
    pendientes: 'No tienes solicitudes pendientes.',
    pasadas: 'Aún no hay historial.',
  };

  return (
    <div>
      <h1 className="page-title">Mis reservas</h1>

      <div className="tabs">
        <button className={`tab ${tab === 'proximas' ? 'active' : ''}`} onClick={() => setTab('proximas')}>Próximas ({proximas.length})</button>
        <button className={`tab ${tab === 'pendientes' ? 'active' : ''}`} onClick={() => setTab('pendientes')}>Pendientes ({pendientes.length})</button>
        <button className={`tab ${tab === 'pasadas' ? 'active' : ''}`} onClick={() => setTab('pasadas')}>Historial</button>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <div className="em">📭</div>
          <p>{emptyMsg[tab]}</p>
        </div>
      ) : (
        lista.map((r) => {
          const puedeCancelar = (r.estado === 'confirmada' || r.estado === 'pendiente') && new Date(r.fechaInicio) > ahora;
          return (
            <div className="reserva-item" key={r.id}>
              <div className="reserva-top">
                <div>
                  <div className="reserva-sala">{r.sala?.nombre || '—'}</div>
                  <div className="reserva-meta">
                    {fmtFechaLarga(todayISOFromDate(r.fechaInicio))} · {fmtHora(r.fechaInicio)}–{fmtHora(r.fechaFin)}
                  </div>
                </div>
                <Badge tipo={r.estado} />
              </div>
              <Badge tipo={r.tipoUso} />
              {r.estado === 'rechazada' && r.motivoRechazo && (
                <p className="hint" style={{ color: 'var(--coral-dark)' }}>Motivo: {r.motivoRechazo}</p>
              )}
              {puedeCancelar && (
                <div className="reserva-actions">
                  <button className="btn btn-coral btn-sm" onClick={() => setConfirmarCancelarId(r.id)}>Cancelar</button>
                </div>
              )}
            </div>
          );
        })
      )}

      {confirmarCancelarId && (
        <div className="overlay center">
          <div className="modal">
            <div className="icon-circle" style={{ background: 'var(--coral-light)' }}>🗑️</div>
            <h2>¿Cancelar esta reserva?</h2>
            <p>Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-coral-solid btn-block" onClick={() => cancelar(confirmarCancelarId)}>Sí, cancelar</button>
              <button className="btn btn-ghost btn-block" onClick={() => setConfirmarCancelarId(null)}>Volver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function todayISOFromDate(isoString) {
  const d = new Date(isoString);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
