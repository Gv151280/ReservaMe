import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import StickerIcon, { GLYPH } from '../../components/StickerIcon';

const TONOS_POR_NOMBRE = { 'Sala de Proyectos': 'blue', CRA: 'green' };

export default function AdminSalas() {
  const { showToast } = useToast();
  const [salas, setSalas] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({});

  function cargar() {
    api.get('/salas').then((d) => setSalas(d.salas)).catch((e) => showToast(e.message, 'error'));
    api.get('/usuarios').then((d) => setUsuarios(d.usuarios)).catch(() => {});
  }
  useEffect(cargar, []);

  function abrirEdicion(sala) {
    setEditandoId(sala.id);
    setBorrador({
      nombre: sala.nombre,
      capacidad: sala.capacidad ?? '',
      equipamiento: sala.equipamiento ?? '',
      modoReserva: sala.modoReserva,
      encargadoId: sala.encargadoId ?? '',
    });
  }

  async function guardarCampo(salaId, patch) {
    try {
      const data = await api.patch(`/salas/${salaId}`, patch);
      setSalas((prev) => prev.map((s) => (s.id === salaId ? { ...s, ...data.sala } : s)));
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function guardarBorrador() {
    await guardarCampo(editandoId, {
      nombre: borrador.nombre,
      capacidad: borrador.capacidad === '' ? null : Number(borrador.capacidad),
      equipamiento: borrador.equipamiento,
      modoReserva: borrador.modoReserva,
      encargadoId: borrador.encargadoId || null,
    });
    setEditandoId(null);
  }

  async function toggleActiva(sala) {
    await guardarCampo(sala.id, { activa: !sala.activa });
    cargar();
  }

  async function crearSala() {
    try {
      const data = await api.post('/salas', { nombre: 'Nueva sala', capacidad: 10, equipamiento: 'Por definir', modoReserva: 'autoservicio' });
      setSalas((prev) => [...prev, data.sala]);
      abrirEdicion(data.sala);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (salas === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Gestión de salas</h1>
      <p className="page-sub">Crea salas, define su modo de reserva y asigna encargados.</p>

      {salas.map((sala) => (
        <div className="admin-card" key={sala.id}>
          <div className="admin-card-top">
            <StickerIcon tono={TONOS_POR_NOMBRE[sala.nombre] || 'purple'} glyph={GLYPH.calendario} size={40} />
            <h3 style={{ flex: 1, marginLeft: 10 }}>{sala.nombre}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => (editandoId === sala.id ? setEditandoId(null) : abrirEdicion(sala))}>
              {editandoId === sala.id ? 'Cerrar' : 'Editar'}
            </button>
          </div>
          <p className="sala-meta">Capacidad {sala.capacidad ?? '—'} · {sala.equipamiento || 'Sin equipamiento'}</p>
          <div className="toggle-row"><span>Modo de reserva</span><b>{sala.modoReserva === 'autoservicio' ? 'Autoservicio' : 'Con aprobación'}</b></div>
          <div className="toggle-row">
            <span>Encargado</span>
            <b>{sala.encargado?.nombre || '— sin asignar'}</b>
          </div>
          <div className="toggle-row">
            <span>Activa</span>
            <div className={`switch ${sala.activa ? 'on' : ''}`} onClick={() => toggleActiva(sala)} />
          </div>

          {editandoId === sala.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid #f0eef3', paddingTop: 12 }}>
              <div className="field">
                <label>Nombre</label>
                <input type="text" value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
              </div>
              <div className="field">
                <label>Capacidad</label>
                <input type="number" value={borrador.capacidad} onChange={(e) => setBorrador({ ...borrador, capacidad: e.target.value })} />
              </div>
              <div className="field">
                <label>Equipamiento</label>
                <input type="text" value={borrador.equipamiento} onChange={(e) => setBorrador({ ...borrador, equipamiento: e.target.value })} />
              </div>
              <div className="field">
                <label>Modo de reserva</label>
                <select value={borrador.modoReserva} onChange={(e) => setBorrador({ ...borrador, modoReserva: e.target.value })}>
                  <option value="autoservicio">Autoservicio</option>
                  <option value="con_aprobacion">Con aprobación</option>
                </select>
              </div>
              <div className="field">
                <label>Encargado</label>
                <select value={borrador.encargadoId} onChange={(e) => setBorrador({ ...borrador, encargadoId: e.target.value })}>
                  <option value="">— sin asignar —</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-secondary btn-block" onClick={guardarBorrador}>Guardar</button>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-primary btn-block" onClick={crearSala}>+ Nueva sala</button>
    </div>
  );
}
