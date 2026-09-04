import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useSession } from '../lib/useSession';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fechaHoraISO(fecha, hora) {
  return new Date(`${fecha}T${hora || '00:00'}:00`).toISOString();
}
function fmtFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export default function Bloqueos() {
  const { user } = useSession();
  const { showToast } = useToast();
  const [salas, setSalas] = useState([]);
  const [bloqueos, setBloqueos] = useState(null);

  const [salaId, setSalaId] = useState('');
  const [fechaInicio, setFechaInicio] = useState(todayISO());
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [horaFin, setHoraFin] = useState('16:15');
  const [motivo, setMotivo] = useState('');
  const [creando, setCreando] = useState(false);

  function cargar() {
    api.get('/salas').then((d) => {
      setSalas(d.salas);
      if (!salaId && d.salas[0]) setSalaId(d.salas[0].id);
    });
    api.get('/bloqueos?activo=true').then((d) => setBloqueos(d.bloqueos)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function crearBloqueo() {
    if (!salaId || !motivo.trim()) {
      showToast('Elige una sala y escribe un motivo.', 'error');
      return;
    }
    const inicio = fechaHoraISO(fechaInicio, horaInicio);
    const fin = fechaHoraISO(fechaFin, horaFin);
    if (new Date(fin) <= new Date(inicio)) {
      showToast('El término debe ser posterior al inicio.', 'error');
      return;
    }
    setCreando(true);
    try {
      await api.post('/bloqueos', { salaId, fechaInicio: inicio, fechaFin: fin, motivo: motivo.trim() });
      showToast('Sala bloqueada.', 'success');
      setMotivo('');
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreando(false);
    }
  }

  async function revertir(id) {
    try {
      await api.patch(`/bloqueos/${id}/revertir`);
      showToast('Bloqueo revertido.', 'info');
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const esAdmin = user?.roles.includes('administrador');

  return (
    <div>
      <h1 className="page-title">Bloqueos de sala</h1>
      <p className="page-sub">Impide reservas en una sala durante horas, días o semanas (ej. mantención, evaluaciones).</p>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Nuevo bloqueo</h3>
        <div className="field">
          <label>Sala</label>
          <select value={salaId} onChange={(e) => setSalaId(e.target.value)}>
            {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Desde (fecha)</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hora</label>
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Hasta (fecha)</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hora</label>
            <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Motivo (obligatorio, lo verán los docentes)</label>
          <input type="text" placeholder="Ej: Sala en mantención" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={creando} onClick={crearBloqueo}>
          {creando ? 'Bloqueando…' : 'Bloquear sala'}
        </button>
      </div>

      <div className="section-label">Bloqueos activos</div>
      {bloqueos === null ? (
        <p className="page-sub">Cargando…</p>
      ) : bloqueos.length === 0 ? (
        <div className="empty-state"><div className="em">✅</div><p>No hay bloqueos activos.</p></div>
      ) : (
        bloqueos.map((b) => {
          const puedeRevertir = esAdmin || b.creadoPor.id === user?.id;
          return (
            <div className="reserva-item" key={b.id}>
              <div className="reserva-top">
                <div>
                  <div className="reserva-sala">{b.sala.nombre}</div>
                  <div className="reserva-meta">{fmtFechaHora(b.fechaInicio)} → {fmtFechaHora(b.fechaFin)} · por {b.creadoPor.nombre}</div>
                </div>
              </div>
              <p className="hint" style={{ color: 'var(--coral-dark)' }}>Motivo: {b.motivo}</p>
              {puedeRevertir && (
                <div className="reserva-actions">
                  <button className="btn btn-coral btn-sm" onClick={() => revertir(b.id)}>Revertir bloqueo</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
