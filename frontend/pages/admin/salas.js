import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import StickerIcon, { GLYPH } from '../../components/StickerIcon';

const TONOS_POR_NOMBRE = { 'Sala de Proyectos': 'blue', CRA: 'green' };

function itemVacio() { return { nombre: '', tieneCantidad: false, cantidadMaxima: '' }; }

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
      encargadoId: sala.encargadoId ?? '',
      items: (sala.itemsEquipamiento && sala.itemsEquipamiento.length > 0
        ? sala.itemsEquipamiento.map((it) => ({ ...it, cantidadMaxima: it.cantidadMaxima ?? '' }))
        : [itemVacio()]),
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
    const itemsLimpios = borrador.items
      .filter((it) => it.nombre.trim())
      .map((it) => ({
        nombre: it.nombre.trim(),
        tieneCantidad: it.tieneCantidad,
        cantidadMaxima: it.tieneCantidad && it.cantidadMaxima ? Number(it.cantidadMaxima) : null,
      }));
    await guardarCampo(editandoId, {
      nombre: borrador.nombre,
      capacidad: borrador.capacidad === '' ? null : Number(borrador.capacidad),
      equipamiento: borrador.equipamiento,
      encargadoId: borrador.encargadoId || null,
      itemsEquipamiento: itemsLimpios,
    });
    setEditandoId(null);
    cargar();
  }

  async function toggleActiva(sala) {
    await guardarCampo(sala.id, { activa: !sala.activa });
    cargar();
  }

  async function crearSala() {
    try {
      const data = await api.post('/salas', { nombre: 'Nueva sala', capacidad: 10, equipamiento: 'Por definir' });
      setSalas((prev) => [...prev, data.sala]);
      abrirEdicion(data.sala);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function actualizarItem(index, campo, valor) {
    setBorrador((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [campo]: valor };
      return { ...prev, items };
    });
  }
  function agregarItem() {
    setBorrador((prev) => ({ ...prev, items: [...prev.items, itemVacio()] }));
  }
  function quitarItem(index) {
    setBorrador((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  if (salas === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Gestión de salas</h1>
      <p className="page-sub">Crea salas, define el encargado y los equipos que se pueden pedir al reservarlas.</p>

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
          <div className="toggle-row">
            <span>Encargado</span>
            <b>{sala.encargado?.nombre || '— sin asignar (aprueban los administradores)'}</b>
          </div>
          <div className="toggle-row">
            <span>Equipos configurables</span>
            <b>{(sala.itemsEquipamiento || []).length}</b>
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
                <label>Equipamiento (texto descriptivo)</label>
                <input type="text" value={borrador.equipamiento} onChange={(e) => setBorrador({ ...borrador, equipamiento: e.target.value })} />
              </div>
              <div className="field">
                <label>Encargado (aprueba las reservas de "Reunión/otro" de esta sala)</label>
                <select value={borrador.encargadoId} onChange={(e) => setBorrador({ ...borrador, encargadoId: e.target.value })}>
                  <option value="">— sin asignar (aprueban los administradores) —</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="section-label">Equipos que se pueden pedir al reservar</div>
              {borrador.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Ej: Notebooks"
                    value={it.nombre}
                    onChange={(e) => actualizarItem(i, 'nombre', e.target.value)}
                    style={{ flex: 2, minWidth: 120 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={it.tieneCantidad} onChange={(e) => actualizarItem(i, 'tieneCantidad', e.target.checked)} />
                    Tiene cantidad
                  </label>
                  {it.tieneCantidad && (
                    <input
                      type="number"
                      placeholder="Máximo"
                      value={it.cantidadMaxima}
                      onChange={(e) => actualizarItem(i, 'cantidadMaxima', e.target.value)}
                      style={{ width: 90 }}
                    />
                  )}
                  <button className="btn btn-coral btn-sm" onClick={() => quitarItem(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={agregarItem} style={{ marginBottom: 12 }}>+ Agregar equipo</button>

              <button className="btn btn-secondary btn-block" onClick={guardarBorrador}>Guardar</button>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-primary btn-block" onClick={crearSala}>+ Nueva sala</button>
    </div>
  );
}
