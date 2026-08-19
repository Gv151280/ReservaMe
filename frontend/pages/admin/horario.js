import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { minutesToHHMM } from '../../lib/dates';

const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // lunes .. domingo
const LABELS = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

// Borrador local de las horas de clase de un día, antes de guardar.
function bloquesABorrador(bloques) {
  return (bloques || []).map((b) => ({ horaInicio: minutesToHHMM(b.horaInicio), horaFin: minutesToHHMM(b.horaFin) }));
}

export default function AdminHorario() {
  const { showToast } = useToast();
  const [dias, setDias] = useState(null);
  const [borradores, setBorradores] = useState({}); // { [diaSemana]: [{horaInicio, horaFin}, ...] }

  function cargar() {
    api
      .get('/horario')
      .then((d) => {
        setDias(d.dias);
        const b = {};
        d.dias.forEach((dia) => { b[dia.diaSemana] = bloquesABorrador(dia.bloques); });
        setBorradores(b);
      })
      .catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function actualizarCampo(dia, patch) {
    try {
      const data = await api.patch(`/horario/${dia.diaSemana}`, patch);
      setDias((prev) => prev.map((d) => (d.diaSemana === dia.diaSemana ? data.dia : d)));
      if (patch.bloques) {
        setBorradores((prev) => ({ ...prev, [dia.diaSemana]: bloquesABorrador(data.dia.bloques) }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function setHoraBloque(diaSemana, index, campo, valor) {
    setBorradores((prev) => {
      const lista = [...prev[diaSemana]];
      lista[index] = { ...lista[index], [campo]: valor };
      return { ...prev, [diaSemana]: lista };
    });
  }

  function agregarHora(dia) {
    const lista = borradores[dia.diaSemana] || [];
    const ultima = lista[lista.length - 1];
    const nuevoInicio = ultima ? ultima.horaFin : '08:00';
    setBorradores((prev) => ({
      ...prev,
      [dia.diaSemana]: [...lista, { horaInicio: nuevoInicio, horaFin: '' }],
    }));
  }

  function quitarHora(dia, index) {
    setBorradores((prev) => ({
      ...prev,
      [dia.diaSemana]: prev[dia.diaSemana].filter((_, i) => i !== index),
    }));
  }

  async function guardarHoras(dia) {
    const lista = borradores[dia.diaSemana] || [];
    for (const b of lista) {
      if (!b.horaInicio || !b.horaFin) {
        showToast('Completa la hora de inicio y término de todas las horas de clase.', 'error');
        return;
      }
    }
    await actualizarCampo(dia, { bloques: lista });
    showToast(`Horas de clase del ${LABELS[dia.diaSemana].toLowerCase()} guardadas.`, 'success');
  }

  if (dias === null) return <p className="page-sub">Cargando…</p>;

  const porDia = Object.fromEntries(dias.map((d) => [d.diaSemana, d]));

  return (
    <div>
      <h1 className="page-title">Horario institucional</h1>
      <p className="page-sub">
        Define, por día, las horas de clase reales (para reservas de &quot;Clase&quot;) y hasta qué hora quedan
        encargados/profesores en el colegio (límite para reservas de &quot;Reunión/otro&quot;). Los recreos son los
        espacios de tiempo que quedan entre una hora y la siguiente — no se configuran aparte.
      </p>

      {ORDEN.map((diaSemana) => {
        const dia = porDia[diaSemana];
        if (!dia) return null;
        const lista = borradores[diaSemana] || [];
        return (
          <div className="admin-card" key={diaSemana}>
            <div className="admin-card-top">
              <h3 style={{ flex: 1 }}>{LABELS[diaSemana]}</h3>
              <div className={`switch ${dia.abierto ? 'on' : ''}`} onClick={() => actualizarCampo(dia, { abierto: !dia.abierto })} />
            </div>

            {dia.abierto ? (
              <>
                <div className="field">
                  <label>Inicio de jornada (apertura del colegio)</label>
                  <input
                    type="time"
                    defaultValue={minutesToHHMM(dia.horaInicio)}
                    onBlur={(e) => actualizarCampo(dia, { horaInicio: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 4 }}>
                  <label>Salida de encargados/profesores (límite para reuniones/otro uso)</label>
                  <input
                    type="time"
                    defaultValue={minutesToHHMM(dia.horaSalidaProfesores)}
                    onBlur={(e) => actualizarCampo(dia, { horaSalidaProfesores: e.target.value })}
                  />
                </div>

                <div className="section-label" style={{ margin: '18px 0 8px' }}>Horas de clase</div>
                {lista.length === 0 && <p className="hint">Sin horas de clase configuradas todavía.</p>}
                {lista.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)', width: 18 }}>{i + 1}ª</span>
                    <input
                      type="time"
                      value={b.horaInicio}
                      onChange={(e) => setHoraBloque(diaSemana, i, 'horaInicio', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--gray)' }}>–</span>
                    <input
                      type="time"
                      value={b.horaFin}
                      onChange={(e) => setHoraBloque(diaSemana, i, 'horaFin', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-coral btn-sm" onClick={() => quitarHora(dia, i)}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => agregarHora(dia)}>+ Agregar hora de clase</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => guardarHoras(dia)}>Guardar horas de clase</button>
                </div>
              </>
            ) : (
              <p className="hint">Colegio cerrado este día — no se aceptan reservas.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
