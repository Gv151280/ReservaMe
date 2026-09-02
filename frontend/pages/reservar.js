import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import StickerIcon, { GLYPH } from '../components/StickerIcon';

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDiasISO(fechaISO, delta) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function fmtFechaBonita(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const texto = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.replace(/(^|\s)([a-záéíóúñ])/g, (_, sp, ch) => sp + ch.toUpperCase());
}
function minutesToHHMM(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
function combinarFechaMinutos(fechaISO, minutos) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, minutos, 0, 0);
  return dt.toISOString();
}
function iconoEquipo(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('notebook')) return '💻';
  if (n.includes('tablet')) return '📱';
  if (n.includes('proyector') || n.includes('data')) return '📽️';
  if (n.includes('audio')) return '🔊';
  return '🧰';
}

function Stepper({ paso }) {
  const pasos = [1, 2, 3, 4];
  return (
    <div className="stepper">
      {pasos.map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
          <div className={`stepper-circle ${n === paso ? 'activo' : ''} ${n < paso ? 'completo' : ''}`}>{n}</div>
          {i < pasos.length - 1 && <div className={`stepper-line ${n < paso ? 'completo' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

export default function Reservar() {
  const router = useRouter();
  const { showToast } = useToast();
  const { salaId, fecha: fechaQuery } = router.query;

  const [paso, setPaso] = useState(1);
  const [sala, setSala] = useState(null);
  const [fecha, setFecha] = useState(todayISO(0));
  const [tipoUso, setTipoUso] = useState('clase');
  const [duracion, setDuracion] = useState(45);
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [bloqueInicio, setBloqueInicio] = useState(null);
  const [horaInicioReunion, setHoraInicioReunion] = useState('');
  const [horaFinReunion, setHoraFinReunion] = useState('');
  const [equipoState, setEquipoState] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => { if (fechaQuery) setFecha(fechaQuery); }, [fechaQuery]);

  useEffect(() => {
    if (!salaId) return;
    api.get('/salas').then((d) => {
      const s = d.salas.find((x) => x.id === salaId) || null;
      setSala(s);
      if (s) {
        const inicial = {};
        (s.itemsEquipamiento || []).forEach((it) => { inicial[it.nombre] = { marcado: false, cantidad: '' }; });
        setEquipoState(inicial);
      }
    });
  }, [salaId]);

  useEffect(() => {
    if (!salaId || !fecha) return;
    api.get(`/salas/${salaId}/disponibilidad?fecha=${fecha}`).then(setDisponibilidad);
    setBloqueInicio(null);
  }, [salaId, fecha]);

  const bloquesDia = disponibilidad?.bloques || [];

  const bloquesRenderizados = useMemo(() => {
    return bloquesDia.map((b, i) => {
      let deshabilitado = b.pasado || b.ocupado;
      let finMin = b.end;
      if (duracion === 90) {
        const sig = bloquesDia[i + 1]; // hora siguiente del día, con o sin recreo entre medio
        if (!sig || sig.ocupado || sig.pasado) deshabilitado = true;
        else finMin = sig.end;
      }
      return { ...b, i, deshabilitado, finMin };
    });
  }, [bloquesDia, duracion]);

  function navFecha(delta) {
    const nueva = addDiasISO(fecha, delta);
    if (nueva < todayISO(0) || nueva > todayISO(30)) return;
    setFecha(nueva);
  }

  function toggleEquipo(nombre) {
    setEquipoState((prev) => ({ ...prev, [nombre]: { ...prev[nombre], marcado: !prev[nombre]?.marcado } }));
  }
  function setCantidad(nombre, valor) {
    setEquipoState((prev) => ({ ...prev, [nombre]: { ...prev[nombre], cantidad: valor } }));
  }

  function continuarPaso1() {
    setPaso(2);
  }

  function continuarPaso2() {
    if (tipoUso === 'clase') {
      const b = bloquesRenderizados[bloqueInicio];
      if (bloqueInicio === null || !b || b.deshabilitado) {
        showToast('Elige un bloque de inicio disponible.', 'error');
        return;
      }
    } else {
      if (!horaInicioReunion || !horaFinReunion) {
        showToast('Completa la hora de inicio y término.', 'error');
        return;
      }
      if (horaFinReunion <= horaInicioReunion) {
        showToast('La hora de término debe ser posterior al inicio.', 'error');
        return;
      }
    }
    setPaso(3);
  }

  function continuarPaso3() {
    const items = sala?.itemsEquipamiento || [];
    for (const it of items) {
      const st = equipoState[it.nombre];
      if (st?.marcado && it.tieneCantidad) {
        const n = Number(st.cantidad);
        if (!n || n <= 0) {
          showToast(`Indica cuántos "${it.nombre}" necesitas.`, 'error');
          return;
        }
      }
    }
    setPaso(4);
  }

  async function confirmarReserva() {
    let fechaInicioISO, fechaFinISO;
    if (tipoUso === 'clase') {
      const b = bloquesRenderizados[bloqueInicio];
      fechaInicioISO = combinarFechaMinutos(fecha, b.start);
      fechaFinISO = combinarFechaMinutos(fecha, b.finMin);
    } else {
      const [hi, mi] = horaInicioReunion.split(':').map(Number);
      const [hf, mf] = horaFinReunion.split(':').map(Number);
      fechaInicioISO = combinarFechaMinutos(fecha, hi * 60 + mi);
      fechaFinISO = combinarFechaMinutos(fecha, hf * 60 + mf);
    }

    const equipamientoSolicitado = (sala.itemsEquipamiento || [])
      .filter((it) => equipoState[it.nombre]?.marcado)
      .map((it) => (it.tieneCantidad ? { nombre: it.nombre, cantidad: Number(equipoState[it.nombre].cantidad) } : { nombre: it.nombre }));

    setEnviando(true);
    try {
      const data = await api.post('/reservas', {
        salaId,
        tipoUso,
        fechaInicio: fechaInicioISO,
        fechaFin: fechaFinISO,
        equipamientoSolicitado,
      });
      setResultado(data.reserva);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  function volver() {
    if (resultado) { router.push('/mis-reservas'); return; }
    if (paso === 1) { router.back(); return; }
    setPaso(paso - 1);
  }

  if (!sala) return <p className="page-sub">Cargando…</p>;

  const cfg = disponibilidad?.horario;
  const itemsSala = sala.itemsEquipamiento || [];
  const equipamientoElegido = itemsSala.filter((it) => equipoState[it.nombre]?.marcado);

  // ---------- Pantalla de resultado ----------
  if (resultado) {
    const esClase = resultado.tipoUso === 'clase';
    return (
      <div>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => router.push('/')}>← Volver</button>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <StickerIcon tono="purple" glyph={GLYPH.calendario} size={52} />
          <div><h1 className="page-title" style={{ margin: 0 }}>{sala.nombre}</h1></div>
        </div>
        {esClase ? (
          <>
            <div className="icono-resultado-exito">✅</div>
            <h2 style={{ textAlign: 'center' }}>Reserva Exitosa</h2>
          </>
        ) : (
          <>
            <div className="icono-resultado-pendiente">✈️</div>
            <h2 style={{ textAlign: 'center' }}>Reserva para Reunión Enviada</h2>
            <p className="hint" style={{ textAlign: 'center', background: 'var(--gray-light)', padding: '12px 14px', borderRadius: 12 }}>
              Espere confirmación del encargado de la sala de {sala.nombre}
            </p>
          </>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => router.push('/mis-reservas')}>Ver mis reservas</button>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={volver}>← Volver</button>

      {paso < 4 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <StickerIcon tono="purple" glyph={GLYPH.calendario} size={52} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{sala.nombre}</h1>
            <p className="page-sub" style={{ margin: '2px 0 0' }}>Capacidad {sala.capacidad ?? '—'} personas</p>
          </div>
        </div>
      )}
      {paso < 4 && sala.equipamiento && (
        <p style={{ fontSize: 13, color: 'var(--gray-dark)', background: 'var(--gray-light)', padding: '10px 12px', borderRadius: 12, marginBottom: 16 }}>
          🎒 {sala.equipamiento}
        </p>
      )}

      <Stepper paso={paso} />

      {paso === 1 && (
        <>
          <div className="field">
            <label>📅 Elige la fecha</label>
            <div className="calendar-row">
              <button onClick={() => navFecha(-1)}>‹</button>
              <div className="calendar-date">{fmtFechaBonita(fecha)}</div>
              <button onClick={() => navFecha(1)}>›</button>
            </div>
          </div>

          <div className="field">
            <label>Tipo de uso</label>
            <div className="segmented">
              <button className={tipoUso === 'clase' ? 'active' : ''} onClick={() => setTipoUso('clase')}>📘 Clase</button>
              <button className={tipoUso === 'reunion_otro' ? 'active' : ''} onClick={() => setTipoUso('reunion_otro')}>🤝 Reunión / otro</button>
            </div>
            {tipoUso === 'reunion_otro' && (
              <p className="hint">El horario de reuniones debe ser confirmado por el encargado de la sala.</p>
            )}
          </div>

          {tipoUso === 'clase' && (
            <div className="field">
              <label>🕒 Duración</label>
              <div className="segmented">
                <button className={duracion === 45 ? 'active' : ''} onClick={() => setDuracion(45)}>45 min</button>
                <button className={duracion === 90 ? 'active' : ''} onClick={() => setDuracion(90)}>90 min (2 bloques)</button>
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block" onClick={continuarPaso1}>Continuar</button>
        </>
      )}

      {paso === 2 && tipoUso === 'clase' && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>Selecciona la hora: ({duracion} minutos)</p>
          <div className="section-label">Disponibilidad por hora</div>
          {disponibilidad && !disponibilidad.abierto ? (
            <div className="empty-state"><div className="em">🌙</div><p>El colegio no tiene jornada este día.</p></div>
          ) : bloquesRenderizados.length === 0 ? (
            <div className="empty-state"><div className="em">🕒</div><p>No hay horas de clase configuradas ese día.</p></div>
          ) : (
            <div className="bloques-grid">
              {bloquesRenderizados.map((b) => (
                <div
                  key={b.i}
                  className={`bloque-chip ${b.deshabilitado ? 'ocupado' : ''} ${bloqueInicio === b.i ? 'selected' : ''}`}
                  onClick={() => !b.deshabilitado && setBloqueInicio(b.i)}
                >
                  {minutesToHHMM(b.start)}–{minutesToHHMM(b.finMin)}
                  <br /><span style={{ fontSize: 10.5, fontWeight: 600 }}>{b.pasado ? 'Pasado' : b.deshabilitado ? 'Ocupado' : 'Libre'}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={continuarPaso2}>Confirmar Hora{duracion === 90 ? 's' : ''}</button>
        </>
      )}

      {paso === 2 && tipoUso === 'reunion_otro' && (
        <>
          <p className="hint">Indique la hora de inicio y término de la reunión.</p>
          {disponibilidad && !disponibilidad.abierto ? (
            <div className="empty-state"><div className="em">🌙</div><p>El colegio no tiene jornada este día.</p></div>
          ) : (
            <>
              <div className="field">
                <label>Hora de inicio</label>
                <input type="time" min={cfg && minutesToHHMM(cfg.horaInicio)} max={cfg && minutesToHHMM(cfg.horaSalidaProfesores)} value={horaInicioReunion} onChange={(e) => setHoraInicioReunion(e.target.value)} />
              </div>
              <div className="field">
                <label>Hora de término</label>
                <input type="time" min={cfg && minutesToHHMM(cfg.horaInicio)} max={cfg && minutesToHHMM(cfg.horaSalidaProfesores)} value={horaFinReunion} onChange={(e) => setHoraFinReunion(e.target.value)} />
              </div>
              {cfg && (
                <p className="hint">Debe estar entre las {minutesToHHMM(cfg.horaInicio)} y las {minutesToHHMM(cfg.horaSalidaProfesores)} (salida de encargados/profesores ese día).</p>
              )}
              <div className="section-label">Disponibilidad horaria actual (referencia)</div>
              <div className="bloques-grid">
                {bloquesDia.map((b, i) => (
                  <div key={i} className={`bloque-chip ${b.ocupado || b.pasado ? 'ocupado' : ''}`} style={{ cursor: 'default' }}>
                    {minutesToHHMM(b.start)}–{minutesToHHMM(b.end)}
                    <br /><span style={{ fontSize: 10.5, fontWeight: 600 }}>{b.pasado ? 'Pasado' : b.ocupado ? 'Ocupado' : 'Libre'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={continuarPaso2}>Continuar</button>
        </>
      )}

      {paso === 3 && (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>Equipos a utilizar (opcional)</p>
          {itemsSala.length === 0 ? (
            <div className="empty-state"><div className="em">🧰</div><p>Esta sala no tiene equipos configurables todavía.</p></div>
          ) : (
            itemsSala.map((it) => {
              const st = equipoState[it.nombre] || { marcado: false, cantidad: '' };
              return (
                <div key={it.nombre} className={`equipo-item ${st.marcado ? 'marcado' : ''}`}>
                  <div className={`equipo-checkbox ${st.marcado ? 'marcado' : ''}`} onClick={() => toggleEquipo(it.nombre)}>{st.marcado ? '✓' : ''}</div>
                  <div className="equipo-nombre" onClick={() => toggleEquipo(it.nombre)}>
                    <span>{iconoEquipo(it.nombre)}</span> {it.nombre}
                  </div>
                  {it.tieneCantidad && st.marcado && (
                    <>
                      <span className="equipo-cantidad-label">Cuántos:</span>
                      <input
                        type="number"
                        min="1"
                        max={it.cantidadMaxima || undefined}
                        className="equipo-cantidad-input"
                        value={st.cantidad}
                        onChange={(e) => setCantidad(it.nombre, e.target.value)}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={continuarPaso3}>Confirmar Equipos</button>
        </>
      )}

      {paso === 4 && (
        <>
          <h2 style={{ margin: '0 0 16px' }}>Resumen</h2>
          <div className="resumen-fila">
            <div className="resumen-dot" style={{ background: 'var(--purple-dark)' }} />
            <div><div className="resumen-label">Fecha</div><div className="resumen-valor">{fmtFechaBonita(fecha)}</div></div>
          </div>
          <div className="resumen-fila">
            <div className="resumen-dot" style={{ background: 'var(--purple)' }} />
            <div><div className="resumen-label">Tipo de uso</div><div className="resumen-valor">{tipoUso === 'clase' ? 'Clase' : 'Reunión'}</div></div>
          </div>
          <div className="resumen-fila">
            <div className="resumen-dot" style={{ background: 'var(--coral)' }} />
            <div>
              <div className="resumen-label">Duración</div>
              <div className="resumen-valor">
                {tipoUso === 'clase' ? `${duracion} minutos` : `de ${horaInicioReunion} hrs a ${horaFinReunion} hrs`}
              </div>
            </div>
          </div>
          <div className="resumen-fila">
            <div className="resumen-dot" style={{ background: 'var(--purple-dark)' }} />
            <div style={{ flex: 1 }}>
              <div className="resumen-label">Equipos requeridos</div>
              {equipamientoElegido.length === 0 ? (
                <div className="resumen-valor">Ninguno</div>
              ) : (
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {equipamientoElegido.map((it) => (
                    <li key={it.nombre} className="resumen-valor" style={{ fontWeight: 600 }}>
                      {it.tieneCantidad ? `${equipoState[it.nombre].cantidad} ${it.nombre.toLowerCase()}` : it.nombre.toLowerCase()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={enviando} onClick={confirmarReserva}>
            {enviando ? 'Enviando…' : tipoUso === 'clase' ? 'Confirmar Reserva' : 'Confirmar Solicitud'}
          </button>
        </>
      )}
    </div>
  );
}
