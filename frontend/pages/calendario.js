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
  const rango = finJornada - inicioJornada;

  if (rango <= 0) {
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

  const pos = (min) => ((Math.min(Math.max(min, inicioJornada), finJornada) - inicioJornada) / rango) * 100;

  return (
    <div>
      <h1 className="page-title">Disponibilidad de salas</h1>
      <p className="page-sub">Jornada del día: {fmtMin(inicioJornada)} a {fmtMin(finJornada)}.</p>
      {SelectorFecha}

      <div style={{ display: 'flex', paddingLeft: 110, marginBottom: 4 }}>
        <div style={{ position: 'relative', flex: 1, height: 28 }}>
          {segmentos.map((s, i) => (
            <div
              key={i}
              title={
                s.tipo === 'clase'
                  ? `Hora ${s.numero}: ${fmtMin(s.inicio)}–${fmtMin(s.fin)}`
                  : s.tipo === 'recreo'
                  ? `Recreo: ${fmtMin(s.inicio)}–${fmtMin(s.fin)}`
                  : 'Fuera de horario de clases'
              }
              style={{
                position: 'absolute',
                left: `${pos(s.inicio)}%`,
                width: `${pos(s.fin) - pos(s.inicio)}%`,
                top: 0,
                bottom: 0,
                background: s.tipo === 'clase' ? 'var(--gray-light, #eee)' : s.tipo === 'recreo' ? '#fde9c8' : 'transparent',
                border: s.tipo === 'clase' ? '1px solid var(--gray, #ccc)' : 'none',
                borderRadius: 4,
                fontSize: 9.5,
                color: 'var(--gray-dark, #555)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {s.tipo === 'clase' ? `H${s.numero}` : s.tipo === 'recreo' ? 'Recreo' : ''}
            </div>
          ))}
        </div>
      </div>

      {salas.length === 0 ? (
        <div className="empty-state"><div className="em">🚪</div><p>No hay salas activas.</p></div>
      ) : (
        salas.map((sala) => (
          <div key={sala.id} className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 100, fontSize: 13, fontWeight: 600 }}>{sala.nombre}</div>
            <div style={{ position: 'relative', flex: 1, height: 34, background: '#fafafa', border: '1px solid var(--gray-light, #eee)', borderRadius: 6, overflow: 'hidden' }}>
              {segmentos.filter((s) => s.tipo === 'recreo').map((s, i) => (
                <div
                  key={`r${i}`}
                  style={{
                    position: 'absolute',
                    left: `${pos(s.inicio)}%`,
                    width: `${pos(s.fin) - pos(s.inicio)}%`,
                    top: 0,
                    bottom: 0,
                    background: '#fdf3df',
                  }}
                />
              ))}
              {sala.ocupaciones.map((o, i) => {
                const inicioMin = minutosDeISO(o.inicio);
                const finMin = minutosDeISO(o.fin);
                if (finMin <= inicioJornada || inicioMin >= finJornada) return null;
                const color = o.tipo === 'bloqueo' ? COLORES.bloqueo : COLORES[o.estado] || COLORES.confirmada;
                return (
                  <div
                    key={i}
                    title={`${o.titulo} (${fmtMin(inicioMin)}–${fmtMin(finMin)})`}
                    style={{
                      position: 'absolute',
                      left: `${pos(inicioMin)}%`,
                      width: `${pos(finMin) - pos(inicioMin)}%`,
                      top: 2,
                      bottom: 2,
                      background: color,
                      borderRadius: 4,
                      fontSize: 10,
                      color: '#fff',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      padding: '2px 4px',
                    }}
                  >
                    {fmtMin(inicioMin)}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fde9c8', borderRadius: 3, marginRight: 4 }} />Recreo</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.confirmada, borderRadius: 3, marginRight: 4 }} />Confirmada</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.pendiente, borderRadius: 3, marginRight: 4 }} />Pendiente</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORES.bloqueo, borderRadius: 3, marginRight: 4 }} />Bloqueada</span>
      </div>
    </div>
  );
}
