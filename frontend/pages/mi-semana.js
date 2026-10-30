import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const COLORES = {
  confirmada: 'var(--purple)',
  pendiente: 'var(--purple-light, #d9c8f0)',
  bloqueo: 'var(--coral, #e86a5c)',
};
const ETIQUETAS = { confirmada: 'Confirmada', pendiente: 'Pendiente', bloqueo: 'Bloqueada' };

export default function MiSemana() {
  const { showToast } = useToast();
  const [dias, setDias] = useState(null);

  useEffect(() => {
    api.get('/reservas/mi-semana')
      .then((d) => setDias(d.dias))
      .catch((e) => {
        showToast(e.message, 'error');
        setDias([]);
      });
  }, []);

  return (
    <div>
      <h1 className="page-title">Mi semana</h1>
      <p className="page-sub">Próximos 7 días en tus salas: reservas y bloqueos.</p>

      {dias === null ? (
        <p className="page-sub">Cargando…</p>
      ) : dias.length === 0 ? (
        <div className="empty-state"><div className="em">📭</div><p>No hay nada agendado en los próximos 7 días.</p></div>
      ) : (
        dias.map((dia) => (
          <div key={dia.fecha} className="admin-card">
            <h3 style={{ margin: '0 0 8px', fontSize: 14.5 }}>{dia.fechaLegible}</h3>
            {dia.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', marginTop: 4, borderRadius: 6, background: '#faf8fc',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{it.salaNombre}</div>
                  <div className="sala-meta" style={{ margin: 0 }}>{it.titulo} · {it.horaInicio}–{it.horaFin}</div>
                </div>
                <span
                  style={{
                    fontSize: 11, color: '#fff',
                    background: it.tipo === 'bloqueo' ? COLORES.bloqueo : COLORES[it.estado] || COLORES.confirmada,
                    borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                  }}
                >
                  {it.tipo === 'bloqueo' ? 'Bloqueada' : ETIQUETAS[it.estado]}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
