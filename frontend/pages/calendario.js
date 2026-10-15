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
// Construye un Date a partir de un día (AAAA-MM-DD) y minutos desde medianoche,
// asumiendo que el navegador está en hora de Chile (igual criterio que el resto de la app).
function fechaDeMinutos(fechaISO, minutos) {
  const base = new Date(`${fechaISO}T00:00:00`);
  return new Date(base.getTime() + minutos * 60000);
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
  const [misEsperas, setMisEsperas] = useState([]);

  function cargar() {
    setHorario(null);
    setSalas(null);
    const desde = new Date(`${fecha}T00:00:00`).toISOString();
    const hasta = new Date(`${fecha}T23:59:59`).toISOString();
    Promise.all([
      api.get('/horario'),
      api.get(`/reservas/calendario?desde=${desde}&hasta=${hasta}`),
      api.get('/reservas/lista-espera/mia'),
    ])
      .then(([h, c, e]) => {
        setHorario(h.dias);
        setSalas(c.salas);
        setMisEsperas(e.entradas);
      })
      .catch((e) => {
        showToast(e.message, 'error');
        setHorario([]);
        setSalas([]);
      });
  }
  useEffect(cargar, [fecha]);

  async function unirseLista(sala, seg) {
    try {
      const inicio = fechaDeMinutos(fecha, seg.inicio).toISOString();
      const fin = fechaDeMinutos(fecha, seg.fin).toISOString();
      await api.post('/reservas/lista-espera', { salaId: sala.id, fechaInicio: inicio, fechaFin: fin });
      showToast('Te avisaremos si esta sala se libera.', 'success');
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function yaEnLista(salaId, seg) {
    const iso = fechaDeMinutos(fecha, seg.inicio).toISOString();
    return misEsperas.some((e) => e.salaId === salaId && new Date(e.fechaInicio).toISOString() === iso);
  }

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
              const enLista = ocupaciones.length > 0 && yaEnLista(sala.id, seg);
              return (
                <div
                  key={sala.id}
                  style={{
                    padding: '6px 8px',
                    marginTop: 4,
                    borderRadius: 6,
                    background: ocupaciones.length ? '#faf8fc' : '#f4fbf5',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  {ocupaciones.length > 0 && (
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      {enLista ? (
                        <span style={{ fontSize: 11, color: 'var(--purple-dark)' }}>✓ En lista de espera</span>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => unirseLista(sala, seg)}>
                          Avisarme si se libera
                        </button>
                      )}
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
