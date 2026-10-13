import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function diaSemanaDe(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}
function minutosDeISO(iso) {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(partes.find((p) => p.type === 'hour').value);
  const m = Number(partes.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

const COLORES = {
  confirmada: 'var(--purple)',
  pendiente: 'var(--purple-light, #d9c8f0)',
  bloqueo: 'var(--coral, #e86a5c)',
};
const ETIQUETAS = { confirmada: 'Reservada', pendiente: 'Pendiente', bloqueo: 'Bloqueada' };

export default function Calendario() {
  const { showToast } = useToast();
  const [fecha, setFecha] = useState(hoyISO());
  const [horario, setHorario] = useState(null);
  const [salas, setSalas] = useState(null);

  function cargar() {
    setHorario(null);
    setSalas(null);
    const desde = new Date(`${fecha}T00:00:00`).toISOString();
    const hasta = new Date(`${fecha}T23:59:59`).toISOString();
    Promise.all([api.get('/horario'), api.get(`/reservas/calendario?desde=${desde}&hasta=${hasta}`)])
      .then(([h, c]) => {
        setHorario(h.dias);
        setSalas(c.salas);
      })
      .catch((e) => {
        showToast(e.message, 'error');
        setHorario([]);
        setSalas([]);
      });
  }
  useEffect(cargar, [fecha]);

  const SelectorFecha = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', margin: '12px 0' }}>
      <label style={{ fontSize: 13 }}>
        Día
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
      </label>
      <button className="btn btn-ghost btn-sm" onClick={() => setFecha(hoyISO())}>Hoy</button>
    </div>
  );

  if (horario === null || salas === null) {
    return (
      <div>
        <h1 className="page-title">Disponibilidad de salas</h1>
        <p className="page-sub">Cargando…</p>
      </div>
    );
  }

  const dia = horario.find((d) => d.diaSemana === diaSemanaDe(fecha));

  if (!dia || !dia.abierto) {
    return (
      <div>
        <h1 className="page-title">Disponibilidad de salas</h1>
        {SelectorFecha}
        <div className="empty-state"><div className="em">🏫</div><p>El colegio no tiene jornada configurada para este día.</p></div>
      </div>
    );
  }

  const inicioJornada = dia.horaInicio;
  const finJornada = dia.horaSalidaProfesores;

  if (finJornada - inicioJornada <= 0) {
    return (
      <div>
        <h1 className="page-title">Disponibilidad de salas</h1>
        {SelectorFecha}
        <div className="empty-state"><div className="em">⚠️</div><p>El horario de este día está mal configurado. Revísalo en Datos del colegio → Horario.</p></div>
      </div>
    );
  }

  // Línea de tiempo institucional, como filas: horas de clase y recreos entre ellas.
  const segmentos = [];
  let cursor = inicioJornada;
  dia.bloques.forEach((b, i) => {
    if (b.horaInicio > cursor) segmentos.push({ tipo: 'fuera', inicio: cursor, fin: b.horaInicio });
    segmentos.push({ tipo: 'clase', inicio: b.horaInicio, fin: b.horaFin, numero: i + 1 });
    cursor = b.horaFin;
  });
  if (cursor < finJornada) segmentos.push({ tipo: 'fuera', inicio: cursor, fin: finJornada });
  segmentos.forEach((s, i) => {
    if (s.tipo === 'fuera' && i > 0 && i < segmentos.length - 1) s.tipo = 'recreo';
  });

  // Para una sala y un segmento, busca qué ocupaciones se cruzan con ese tramo.
  function ocupacionesEnSegmento(sala, seg) {
    return sala.ocupaciones
      .map((o) => ({ ...o, inicioMin: minutosDeISO(o.inicio), finMin: minutosDeISO(o.fin) }))
      .filter((o) => o.finMin > seg.inicio && o.inicioMin < seg.fin);
  }

  return (
    <div>
      <h1 className="page-title">Disponibilidad de salas</h1>
      <p className="page-sub">Jornada del día: {fmtMin(inicioJornada)} a {fmtMin(finJornada)}.</p>
      {SelectorFecha}

      {salas.length === 0 ? (
        <div className="empty-state"><div className="em">🚪</div><p>No hay salas activas.</p></div>
      ) : (
        segmentos.map((seg, i) => (
          <div key={i} className="admin-card" style={{ borderLeft: seg.tipo === 'recreo' ? '4px solid #f0b94d' : '4px solid var(--purple)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>
                {seg.tipo === 'clase' ? `Hora ${seg.numero}` : seg.tipo === 'recreo' ? 'Recreo' : 'Fuera de horario'}
              </strong>
              <span className="sala-meta" style={{ margin: 0 }}>{fmtMin(seg.inicio)} – {fmtMin(seg.fin)}</span>
            </div>

            {salas.map((sala) => {
              const ocupaciones = ocupacionesEnSegmento(sala, seg);
              return (
                <div
                  key={sala.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    marginTop: 4,
                    borderRadius: 6,
                    background: ocupaciones.length ? '#faf8fc' : '#f4fbf5',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{sala.nombre}</span>
                  {ocupaciones.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--gray, #888)' }}>Libre</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {ocupaciones.map((o, j) => (
                        <span
                          key={j}
                          style={{
                            fontSize: 11,
                            color: '#fff',
                            background: o.tipo === 'bloqueo' ? COLORES.bloqueo : COLORES[o.estado] || COLORES.confirmada,
                            borderRadius: 4,
                            padding: '2px 6px',
                            whiteSpace: 'nowrap',
                          }}
                          title={o.titulo}
                        >
                          {o.tipo === 'bloqueo' ? 'Bloqueada' : ETIQUETAS[o.estado]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.confirmada, borderRadius: 3, marginRight: 4 }} />Reservada</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.pendiente, borderRadius: 3, marginRight: 4 }} />Pendiente</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.bloqueo, borderRadius: 3, marginRight: 4 }} />Bloqueada</span>
      </div>
    </div>
  );
}
