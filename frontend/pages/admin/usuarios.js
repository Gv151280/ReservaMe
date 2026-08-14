import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

const ROLES = ['docente', 'encargado_sala', 'administrador'];
const LABELS = { docente: 'Docente', encargado_sala: 'Encargado de sala', administrador: 'Administrador' };

function initials(nombre) {
  return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminUsuarios() {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState(null);

  function cargar() {
    api.get('/usuarios').then((d) => setUsuarios(d.usuarios)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  async function toggleRol(usuario, rol) {
    const nuevosRoles = usuario.roles.includes(rol) ? usuario.roles.filter((r) => r !== rol) : [...usuario.roles, rol];
    try {
      const data = await api.patch(`/usuarios/${usuario.id}/roles`, { roles: nuevosRoles });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? { ...u, roles: data.usuario.roles } : u)));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (usuarios === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Gestión de usuarios</h1>
      <p className="page-sub">Asigna roles. Una persona puede tener más de uno.</p>

      {usuarios.map((u) => (
        <div className="admin-card" key={u.id}>
          <div className="admin-card-top">
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initials(u.nombre)}</div>
            <div style={{ flex: 1, marginLeft: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14.5 }}>{u.nombre}</h3>
              <p className="sala-meta" style={{ margin: 0 }}>{u.email}</p>
            </div>
          </div>
          <div>
            {ROLES.map((rol) => (
              <span
                key={rol}
                className={`role-chip ${u.roles.includes(rol) ? 'on' : ''}`}
                onClick={() => toggleRol(u, rol)}
              >
                {LABELS[rol]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
