import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, tieneRol } from '../lib/useSession';
import { api } from '../lib/api';

const ICONS = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z" />,
  cal: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  door: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <circle cx="14" cy="12" r="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2-5 5-5s5 2 5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15 20c0-2.5 1-4.3 3-4.8" />
    </>
  ),
};

function NavIcon({ name, active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--purple)' : 'var(--gray)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export default function BottomNav() {
  const { user } = useSession();
  const router = useRouter();
  const [pendientesCount, setPendientesCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get('/reservas/pendientes').then((d) => setPendientesCount(d.reservas.length)).catch(() => {});
  }, [user, router.pathname]);

  if (!user) return null;

  const items = [
    { href: '/', label: 'Inicio', icon: 'home' },
    { href: '/mis-reservas', label: 'Mis reservas', icon: 'cal' },
  ];
  // El backend ya filtra /reservas/pendientes por salas a cargo (o todas si es admin);
  // mostramos el ítem si el usuario tiene el rol o si es admin.
  if (tieneRol(user, 'encargado_sala') || tieneRol(user, 'administrador')) {
    items.push({ href: '/pendientes', label: 'Pendientes', icon: 'check', count: pendientesCount });
  }
  if (tieneRol(user, 'administrador')) {
    items.push({ href: '/admin/salas', label: 'Salas', icon: 'door' });
    items.push({ href: '/admin/horario', label: 'Horario', icon: 'clock' });
    items.push({ href: '/admin/usuarios', label: 'Usuarios', icon: 'users' });
  }

  return (
    <div className="bottom-nav">
      {items.map((it) => {
        const active = router.pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={`nav-item ${active ? 'active' : ''}`}>
            {it.count > 0 && <span className="nav-count">{it.count}</span>}
            <NavIcon name={it.icon} active={active} />
            <span className="nav-label">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
