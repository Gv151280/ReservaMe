import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

function BarraLista({ titulo, datos, colorVar = '--purple' }) {
  if (!datos || datos.length === 0) {
    return (
      <div className="admin-card">
        <h3 style={{ margin: '0 0 8px', fontSize: 14.5 }}>{titulo}</h3>
        <p className="sala-meta" style={{ margin: 0 }}>Sin datos para este período.</p>
      </div>
    );
  }
  const max = Math.max(...datos.map((d) => d.cantidad));
  return (
    <div className="admin-card">
      <h3 style={{ margin: '0 0 10px', fontSize: 14.5 }}>{titulo}</h3>
      {datos.map((d) => (
        <div key={d.nombre} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{d.nombre}</span>
            <span className="sala-meta" style={{ margin: 0 }}>{d.cantidad}</span>
          </div>
          <div style={{ background: 'var(--gray-light, #eee)', borderRadius: 6, height: 8, marginTop: 3 }}>
            <div
              style={{
                width: `${(d.cantidad / max) * 100}%`,
                background: `var(${colorVar})`,
                height: '100%',
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Estadisticas() {
  const { showToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [desdeFecha, setDesdeFecha] = useState('');
  const [hastaFecha, setHastaFecha] = useState('');

  function cargar() {
    setDatos(null);
    const params = new URLSearchParams();
    if (desdeFecha) params.set('desde', new Date(`${desdeFecha}T00:00:00`).toISOString());
    if (hastaFecha) params.set('hasta', new Date(`${hastaFecha}T23:59:59`).toISOString());
    const qs = params.toString();
    api.get(`/reservas/estadisticas${qs ? `?${qs}` : ''}`)
      .then(setDatos)
      .catch((e) => {
        showToast(e.message, 'error');
        setDatos({ total: 0, porSala: [], porHora: [], porDiaSemana: [], porTipoUso: { clase: 0, reunion_otro: 0 } });
      });
  }
  useEffect(cargar, []);

  const tipoUsoDatos = datos
    ? [
        { nombre: 'Clase', cantidad: datos.porTipoUso.clase },
        { nombre: 'Reunión / otro', cantidad: datos.porTipoUso.reunion_otro },
      ].filter((d) => d.cantidad > 0)
    : [];

  return (
    <div>
      <h1 className="page-title">Estadísticas de uso</h1>
      <p className="page-sub">Reservas confirmadas: qué salas, horas y días se usan más.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', margin: '12px 0' }}>
        <label style={{ fontSize: 13 }}>
          Desde
          <input type="date" value={desdeFecha} onChange={(e) => setDesdeFecha(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Hasta
          <input type="date" value={hastaFecha} onChange={(e) => setHastaFecha(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
        </label>
        <button className="btn btn-coral-solid btn-sm" onClick={cargar}>Aplicar</button>
      </div>

      {datos === null ? (
        <p className="page-sub">Cargando…</p>
      ) : (
        <>
          <p className="page-sub">Total de reservas confirmadas en el período: <b>{datos.total}</b></p>
          <BarraLista titulo="Por sala" datos={datos.porSala} />
          <BarraLista titulo="Por hora del día" datos={datos.porHora} colorVar="--purple-dark" />
          <BarraLista titulo="Por día de la semana" datos={datos.porDiaSemana} />
          <BarraLista titulo="Por tipo de uso" datos={tipoUsoDatos} colorVar="--purple-dark" />
        </>
      )}
    </div>
  );
}
