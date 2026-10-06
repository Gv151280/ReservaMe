import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useSession, tieneRol } from '../lib/useSession';

const ACCIONES = {
  'reserva.aprobar': 'Aprobó una reserva',
  'reserva.rechazar': 'Rechazó una reserva',
  'reserva.anular': 'Anuló una reserva',
  'bloqueo.crear': 'Creó un bloqueo',
  'bloqueo.revertir': 'Revirtió un bloqueo',
};

function fmtFechaHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function resumen(detalle) {
  const d = detalle || {};
  const partes = [];
  if (d.sala) partes.push(`Sala: ${d.sala}`);
  if (d.fechaInicio) partes.push(`Horario: ${fmtFechaHora(d.fechaInicio)}`);
  if (d.motivo) partes.push(`Motivo: ${d.motivo}`);
  if (d.reservasAnuladas !== undefined) partes.push(`Reservas anuladas: ${d.reservasAnuladas}`);
  return partes.join(' · ');
}

export default function Auditoria() {
  const { user } = useSession();
  const { showToast } = useToast();
  const [registros, setRegistros] = useState(null);
  const [accion, setAccion] = useState('');

  const esAdmin = tieneRol(user, 'administrador');

  useEffect(() => {
    if (!esAdmin) return;
    setRegistros(null);
    const qs = accion ? `?accion=${encodeURIComponent(accion)}` : '';
    api.get(`/reservas/auditoria${qs}`)
      .then((d) => setRegistros(d.registros))
      .catch((e) => {
        showToast(e.message, 'error');
        setRegistros([]);
      });
  }, [esAdmin, accion]);

  if (!esAdmin) {
    return <p className="page-sub">Solo el administrador puede ver el registro de auditoría.</p>;
  }

  return (
    <div>
      <h1 className="page-title">Registro de auditoría</h1>
      <p className="page-sub">Acciones sensibles realizadas por directivos, encargados y administradores.</p>

      <div style={{ margin: '12px 0' }}>
        <label style={{ fontSize: 13 }}>
          Filtrar por acción
          <select value={accion} onChange={(e) => setAccion(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
            <option value="">Todas</option>
            {Object.entries(ACCIONES).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
      </div>

      {registros === null ? (
        <p className="page-sub">Cargando…</p>
      ) : registros.length === 0 ? (
        <div className="empty-state">
          <div className="em">📭</div>
          <p>No hay registros para este filtro.</p>
        </div>
      ) : (
        registros.map((r) => (
          <div className="admin-card" key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{ACCIONES[r.accion] || r.accion}</strong>
              <span className="sala-meta" style={{ margin: 0 }}>{fmtFechaHora(r.creadoEn)}</span>
            </div>
            <p className="sala-meta" style={{ margin: '4px 0 0' }}>
              Por {r.usuarioNombre}
            </p>
            {resumen(r.detalle) && (
              <p className="sala-meta" style={{ margin: '4px 0 0' }}>{resumen(r.detalle)}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
