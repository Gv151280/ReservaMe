import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const TAREAS = {
  'recordatorios-clase': { nombre: 'Recordatorios de clase', frecuenciaHoras: 0.5 }, // cada 5 min, tolerancia 30 min
  'recordatorios-pendientes': { nombre: 'Aviso de pendientes sin respuesta', frecuenciaHoras: 8 }, // cada 6h, tolerancia 8h
  'respaldo-semanal': { nombre: 'Recordatorio de respaldo semanal', frecuenciaHoras: 24 * 9 }, // semanal, tolerancia 9 días
};

const ENLACES_EXTERNOS = [
  { nombre: 'Render (backend)', desc: 'Logs y estado del servidor', url: 'https://dashboard.render.com' },
  { nombre: 'Vercel (frontend)', desc: 'Deploys del sitio', url: 'https://vercel.com/dashboard' },
  { nombre: 'Neon (base de datos)', desc: 'Uso de cómputo y pausas', url: 'https://console.neon.tech' },
  { nombre: 'Sentry', desc: 'Errores capturados en producción', url: 'https://sentry.io' },
  { nombre: 'UptimeRobot', desc: 'Disponibilidad del backend', url: 'https://dashboard.uptimerobot.com' },
  { nombre: 'cron-job.org', desc: 'Historial de tareas programadas', url: 'https://console.cron-job.org/jobs' },
];

function fmtFechaHora(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function estadoDe(tarea, config) {
  if (!tarea) return { color: '#999', texto: 'Sin registro todavía' };
  const horasDesde = (Date.now() - new Date(tarea.ultimaEjecucion).getTime()) / (1000 * 60 * 60);
  if (horasDesde <= config.frecuenciaHoras) return { color: '#1a7a3c', texto: 'Al día' };
  if (horasDesde <= config.frecuenciaHoras * 2) return { color: '#c98a1f', texto: 'Atrasada' };
  return { color: 'var(--coral-dark, #b33)', texto: 'Sin ejecutarse hace tiempo' };
}

export default function Salud() {
  const { showToast } = useToast();
  const [tareas, setTareas] = useState(null);

  useEffect(() => {
    api.get('/reservas/salud')
      .then((d) => setTareas(d.tareas))
      .catch((e) => {
        showToast(e.message, 'error');
        setTareas([]);
      });
  }, []);

  return (
    <div>
      <h1 className="page-title">Salud del sistema</h1>
      <p className="page-sub">Chequeo rápido de las tareas automáticas y enlaces a las herramientas externas.</p>

      <div className="section-label">Tareas programadas</div>
      {tareas === null ? (
        <p className="page-sub">Cargando…</p>
      ) : (
        Object.entries(TAREAS).map(([clave, config]) => {
          const tarea = tareas.find((t) => t.clave === clave);
          const estado = estadoDe(tarea, config);
          return (
            <div key={clave} className="admin-card" style={{ borderLeft: `4px solid ${estado.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 14 }}>{config.nombre}</strong>
                <span style={{ fontSize: 12, fontWeight: 600, color: estado.color }}>{estado.texto}</span>
              </div>
              <p className="sala-meta" style={{ margin: '4px 0 0' }}>
                {tarea ? `Última ejecución: ${fmtFechaHora(tarea.ultimaEjecucion)}` : 'Todavía no se ha ejecutado ninguna vez.'}
              </p>
            </div>
          );
        })
      )}

      <div className="section-label" style={{ marginTop: 20 }}>Paneles externos</div>
      {ENLACES_EXTERNOS.map((e) => (
        <a
          key={e.nombre}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>{e.nombre}</h3>
              <p className="sala-meta" style={{ margin: 0 }}>{e.desc}</p>
            </div>
            <span style={{ fontSize: 18 }}>↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}
