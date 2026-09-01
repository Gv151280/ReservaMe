import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';
import { todayISO, fmtFechaLarga, minutesToHHMM, combinarFechaMinutos, fmtHora } from '../lib/dates';
import { useToast } from '../components/Toast';
 
export default function Reservar() {
  const router = useRouter();
  const { showToast } = useToast();
  const { salaId, fecha: fechaQuery, bloque: bloqueQuery } = router.query;
 
  const [sala, setSala] = useState(null);
  const [fecha, setFecha] = useState(todayISO(0));
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [tipoUso, setTipoUso] = useState('clase');
  const [duracion, setDuracion] = useState(45);
  const [bloqueInicio, setBloqueInicio] = useState(null);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);
 
  useEffect(() => {
    if (fechaQuery) setFecha(fechaQuery);
  }, [fechaQuery]);
 
  useEffect(() => {
    if (bloqueQuery !== undefined) setBloqueInicio(Number(bloqueQuery));
  }, [bloqueQuery]);
 
  useEffect(() => {
    if (!salaId) return;
    api.get('/salas').then((d) => setSala(d.salas.find((s) => s.id === salaId) || null));
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
        const sig = bloquesDia[i + 1];
        const esAdyacente = sig && sig.start === b.end; // sin recreo entre medio
        if (!esAdyacente || sig.ocupado || sig.pasado) {
          deshabilitado = true; // no se puede formar un bloque de 90 min desde aquí
        } else {
          finMin = sig.end;
        }
      }
      return { ...b, i, deshabilitado, finMin };
    });
  }, [bloquesDia, duracion]);
 
  async function confirmar() {
    if (!sala || !disponibilidad?.abierto) {
      showToast('El colegio no tiene jornada ese día.', 'error');
      return;
    }
    let fechaInicioISO, fechaFinISO;
 
    if (tipoUso === 'clase') {
      const b = bloquesRenderizados[bloqueInicio];
      if (bloqueInicio === null || !b || b.deshabilitado) {
        showToast('Elige un bloque de inicio disponible.', 'error');
        return;
      }
      fechaInicioISO = combinarFechaMinutos(fecha, b.start);
      fechaFinISO = combinarFechaMinutos(fecha, b.finMin);
    } else {
      if (!horaInicio || !horaFin) {
        showToast('Completa la hora de inicio y término.', 'error');
        return;
      }
      const [hi, mi] = horaInicio.split(':').map(Number);
      const [hf, mf] = horaFin.split(':').map(Number);
      fechaInicioISO = combinarFechaMinutos(fecha, hi * 60 + mi);
      fechaFinISO = combinarFechaMinutos(fecha, hf * 60 + mf);
    }
 
    setEnviando(true);
    try {
      const data = await api.post('/reservas', {
        salaId,
        tipoUso,
        fechaInicio: fechaInicioISO,
        fechaFin: fechaFinISO,
      });
      setConfirmacion(data.reserva);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  }
 
  if (!sala) return <p className="page-sub">Cargando…</p>;
 
  const cfg = disponibilidad?.horario;
 
  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => router.back()}>← Volver</button>
      <h1 className="page-title">Reservar {sala.nombre}</h1>
      <p className="page-sub">
        {sala.modoReserva === 'autoservicio' ? 'Esta sala se confirma al instante.' : 'Esta sala requiere aprobación del encargado.'}
      </p>
 
      <div className="field">
        <label>Tipo de uso</label>
        <div className="segmented">
          <button className={tipoUso === 'clase' ? 'active' : ''} onClick={() => { setTipoUso('clase'); setBloqueInicio(null); }}>📘 Clase</button>
          <button className={tipoUso === 'reunion_otro' ? 'active' : ''} onClick={() => { setTipoUso('reunion_otro'); setBloqueInicio(null); }}>🤝 Reunión / otro</button>
        </div>
      </div>
 
      <div className="field">
        <label>Fecha</label>
        <input type="date" value={fecha} min={todayISO(0)} max={todayISO(30)} onChange={(e) => setFecha(e.target.value)} />
      </div>
 
      {disponibilidad && !disponibilidad.abierto && (
        <div className="empty-state">
          <div className="em">🌙</div>
          <p>El colegio no tiene jornada este día. Elige otra fecha.</p>
        </div>
      )}
 
      {disponibilidad && disponibilidad.abierto && tipoUso === 'clase' && (
        <>
          <div className="field">
            <label>Duración</label>
            <div className="segmented">
              <button className={duracion === 45 ? 'active' : ''} onClick={() => setDuracion(45)}>45 min</button>
              <button className={duracion === 90 ? 'active' : ''} onClick={() => setDuracion(90)}>90 min (2 bloques)</button>
            </div>
            <p className="hint">Los bloques corresponden a las horas de clase reales de ese día (no incluyen recreos).</p>
          </div>
 
          {bloquesRenderizados.length === 0 ? (
            <div className="empty-state">
              <div className="em">🕒</div>
              <p>No hay bloques de clase disponibles ese día con el horario configurado.</p>
            </div>
          ) : (
            <div className="field">
              <label>Bloque de inicio</label>
              <div className="bloques-grid">
                {bloquesRenderizados.map((b) => (
                  <div
                    key={b.i}
                    className={`bloque-chip ${b.deshabilitado ? 'ocupado' : ''} ${bloqueInicio === b.i ? 'selected' : ''}`}
                    onClick={() => !b.deshabilitado && setBloqueInicio(b.i)}
                  >
                    {minutesToHHMM(b.start)}–{minutesToHHMM(b.finMin)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
 
      {disponibilidad && disponibilidad.abierto && tipoUso === 'reunion_otro' && (
        <>
          <div className="field">
            <label>Hora de inicio</label>
            <input type="time" min={minutesToHHMM(cfg.horaInicio)} max={minutesToHHMM(cfg.horaSalidaProfesores)} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora de término</label>
            <input type="time" min={minutesToHHMM(cfg.horaInicio)} max={minutesToHHMM(cfg.horaSalidaProfesores)} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
          <p className="hint">
            Duración libre — por ejemplo, una reunión de apoderados o un taller. Debe estar entre las {minutesToHHMM(cfg.horaInicio)} y las{' '}
            {minutesToHHMM(cfg.horaSalidaProfesores)} (salida de encargados/profesores ese día), y no chocar con otra reserva.
          </p>
        </>
      )}
 
      <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={enviando} onClick={confirmar}>
        {enviando ? 'Enviando…' : sala.modoReserva === 'autoservicio' ? 'Confirmar reserva' : 'Enviar solicitud'}
      </button>
 
      {confirmacion && (
        <div className="overlay">
          <div className="modal">
            <div className="icon-circle" style={{ background: confirmacion.estado === 'confirmada' ? 'var(--green-light)' : 'var(--amber-light)' }}>
              {confirmacion.estado === 'confirmada' ? '✅' : '⏳'}
            </div>
            <h2>{confirmacion.estado === 'confirmada' ? '¡Reserva confirmada!' : 'Solicitud enviada'}</h2>
            <p>
              {confirmacion.estado === 'confirmada'
                ? 'Tu sala está lista, te esperamos.'
                : 'Quedó pendiente hasta que el encargado la apruebe. Te avisaremos apenas responda.'}
            </p>
            <div className="detail-box">
              <b>{sala.nombre}</b><br />
              {fmtFechaLarga(fecha)}<br />
              {fmtHora(confirmacion.fechaInicio)} – {fmtHora(confirmacion.fechaFin)}<br />
              {tipoUso === 'clase' ? 'Uso: Clase' : 'Uso: Reunión / otro'}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-block" onClick={() => router.push('/mis-reservas')}>Ver mis reservas</button>
              <button className="btn btn-ghost btn-block" onClick={() => router.push('/')}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
