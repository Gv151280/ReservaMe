import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { minutesToHHMM } from '../../lib/dates';

const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // lunes .. domingo
const LABELS = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

export default function AdminHorario() {
  const { showToast } = useToast();
  const [dias, setDias] = useState(null);

  function cargar() {
    api.get('/horario').then((d) => setDias(d.dias)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function actualizar(dia, patch) {
    try {
      const data = await api.patch(`/horario/${dia.diaSemana}`, patch);
      setDias((prev) => prev.map((d) => (d.diaSemana === dia.diaSemana ? data.dia : d)));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (dias === null) return <p className="page-sub">Cargando…</p>;

  const porDia = Object.fromEntries(dias.map((d) => [d.diaSemana, d]));

  return (
    <div>
      <h1 className="page-title">Horario institucional</h1>
      <p className="page-sub">
        Define, por día, hasta qué hora hay clases (bloques de 45 min para reservas de &quot;Clase&quot;) y hasta qué hora
        quedan encargados/profesores en el colegio (límite para reservas de &quot;Reunión/otro&quot;).
      </p>

      {ORDEN.map((diaSemana) => {
        const dia = porDia[diaSemana];
        if (!dia) return null;
        return (
          <div className="admin-card" key={diaSemana}>
            <div className="admin-card-top">
              <h3 style={{ flex: 1 }}>{LABELS[diaSemana]}</h3>
              <div className={`switch ${dia.abierto ? 'on' : ''}`} onClick={() => actualizar(dia, { abierto: !dia.abierto })} />
            </div>

            {dia.abierto ? (
              <>
                <div className="field">
                  <label>Inicio de jornada</label>
                  <input
                    type="time"
                    defaultValue={minutesToHHMM(dia.horaInicio)}
                    onBlur={(e) => actualizar(dia, { horaInicio: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Salida de estudiantes (fin de bloques de clase)</label>
                  <input
                    type="time"
                    defaultValue={minutesToHHMM(dia.horaSalidaEstudiantes)}
                    onBlur={(e) => actualizar(dia, { horaSalidaEstudiantes: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 4 }}>
                  <label>Salida de encargados/profesores (límite para reuniones/otro uso)</label>
                  <input
                    type="time"
                    defaultValue={minutesToHHMM(dia.horaSalidaProfesores)}
                    onBlur={(e) => actualizar(dia, { horaSalidaProfesores: e.target.value })}
                  />
                </div>
                {dia.horaSalidaProfesores < dia.horaSalidaEstudiantes && (
                  <p className="hint" style={{ color: 'var(--coral-dark)' }}>⚠️ La salida de profesores no puede ser antes que la de estudiantes.</p>
                )}
                {dia.horaInicio >= dia.horaSalidaEstudiantes && (
                  <p className="hint" style={{ color: 'var(--coral-dark)' }}>⚠️ El inicio de jornada debe ser antes de la salida de estudiantes.</p>
                )}
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
