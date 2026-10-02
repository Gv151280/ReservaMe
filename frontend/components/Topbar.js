import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import LogoMark from './LogoMark';
import SettingsMenu from './SettingsMenu';
import { api } from '../lib/api';
import { useSession } from '../lib/useSession';

const ROL_LABEL = { docente: 'Docente', encargado_sala: 'Encargado de sala', directivo: 'Directivo (Jefe UTP)', administrador: 'Administrador' };
const ORDEN_ROLES = ['administrador', 'directivo', 'encargado_sala', 'docente'];

function initials(nombre) {
  return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function rolesTexto(roles) {
  const ordenados = ORDEN_ROLES.filter((r) => roles.includes(r));
  return ordenados.map((r) => ROL_LABEL[r] || r).join(' · ');
}

export default function Topbar() {
  const { user, logout } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [colegio, setColegio] = useState(null);
  const noLeidas = notifs.filter((n) => !n.leida).length;

  useEffect(() => {
    if (!user) return;
    api.get('/notificaciones/mias').then((d) => setNotifs(d.notificaciones)).catch(() => {});
    api.get('/colegio').then((d) => setColegio(d.colegio)).catch(() => {});
  }, [user]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && noLeidas > 0) {
      await api.patch('/notificaciones/marcar-leidas');
      setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
  }

  if (!user) return null;

  return (
    <div className="topbar" style={{ position: 'relative' }}>
      <LogoMark />
      <div>
        <div className="brand-title">ReservaMe{colegio?.nombre ? ` · ${colegio.nombre}` : ''}</div>
        <div className="brand-sub">{user.nombre} · <b style={{ color: 'var(--purple-dark)' }}>{rolesTexto(user.roles)}</b></div>
      </div>
      {colegio?.logoUrl && <img src={colegio.logoUrl} alt="" style={{ height: 30, width: 30, borderRadius: 8, objectFit: 'cover', marginLeft: 4 }} />}
      <div className="topbar-actions">
        <button className="bell-btn" onClick={toggle} aria-label="Notificaciones">
          🔔{noLeidas > 0 && <span className="bell-dot" />}
        </button>
        <SettingsMenu />
        <div className="avatar" title={`${user.email} — clic para cerrar sesión`} onClick={() => logout().then(() => router.push('/login'))} style={{ cursor: 'pointer' }}>
          {initials(user.nombre)}
        </div>
      </div>
      {open && (
        <div className="notif-panel">
          <h4>Notificaciones</h4>
          {notifs.length === 0 ? (
            <div className="notif-empty">Sin notificaciones por ahora.</div>
          ) : (
            notifs.slice(0, 8).map((n) => (
              <div className="notif-item" key={n.id}>{n.mensaje}</div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
