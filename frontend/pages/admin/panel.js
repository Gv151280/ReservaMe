import Link from 'next/link';

const SECCIONES = [
  { href: '/admin/colegio', titulo: 'Colegio', desc: 'Nombre y logo del establecimiento.', icon: '🏫' },
  { href: '/admin/horario', titulo: 'Horario', desc: 'Horas de clase y horario institucional por día.', icon: '🕐' },
  { href: '/admin/salas', titulo: 'Salas', desc: 'Salas disponibles, encargados y equipamiento.', icon: '🚪' },
  { href: '/admin/usuarios', titulo: 'Usuarios', desc: 'Roles de cada persona del colegio.', icon: '👥' },
];

export default function AdminPanel() {
  return (
    <div>
      <h1 className="page-title">Datos del colegio</h1>
      <p className="page-sub">Información que se define una vez y cambia con poca frecuencia.</p>

      {SECCIONES.map((s) => (
        <Link href={s.href} key={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14.5 }}>{s.titulo}</h3>
              <p className="sala-meta" style={{ margin: 0 }}>{s.desc}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
