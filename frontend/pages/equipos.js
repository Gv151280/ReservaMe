import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useSession } from '../lib/useSession';
import StickerIcon, { GLYPH } from '../components/StickerIcon';

function itemVacio() { return { nombre: '', tieneCantidad: false, cantidadMaxima: '' }; }

export default function Equipos() {
  const { user } = useSession();
  const { showToast } = useToast();
  const [salas, setSalas] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({});

  function cargar() {
    api.get('/salas').then((d) => setSalas(d.salas)).catch((e) => showToast(e.message, 'error'));
  }
  useEffect(cargar, []);

  const misSalas = (salas || []).filter((s) => s.encargado?.id === user?.id);

  function abrirEdicion(sala) {
    setEditandoId(sala.id);
    setBorrador({
      equipamiento: sala.equipamiento ?? '',
      items: (sala.itemsEquipamiento && sala.itemsEquipamiento.length > 0
        ? sala.itemsEquipamiento.map((it) => ({ ...it, cantidadMaxima: it.cantidadMaxima ?? '' }))
        : [itemVacio()]),
    });
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

  async function guardar(salaId) {
    const itemsLimpios = borrador.items
      .filter((it) => it.nombre.trim())
      .map((it) => ({
        nombre: it.nombre.trim(),
        tieneCantidad: it.tieneCantidad,
        cantidadMaxima: it.tieneCantidad && it.cantidadMaxima ? Number(it.cantidadMaxima) : null,
      }));
    try {
      await api.patch(`/salas/${salaId}`, { equipamiento: borrador.equipamiento, itemsEquipamiento: itemsLimpios });
      showToast('Equipos guardados.', 'success');
      setEditandoId(null);
      cargar();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (salas === null) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Equipos de mi sala</h1>
      <p className="page-sub">Define qué equipos y en qué cantidad hay disponibles para pedir al reservar tu sala.</p>

      {misSalas.length === 0 ? (
        <div className="empty-state">
          <div className="em">🧰</div>
          <p>No tienes ninguna sala asignada como encargado todavía.</p>
        </div>
      ) : (
        misSalas.map((sala) => (
          <div className="admin-card" key={sala.id}>
            <div className="admin-card-top">
              <StickerIcon tono="purple" glyph={GLYPH.calendario} size={40} />
              <h3 style={{ flex: 1, marginLeft: 10 }}>{sala.nombre}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => (editandoId === sala.id ? setEditandoId(null) : abrirEdicion(sala))}>
                {editandoId === sala.id ? 'Cerrar' : 'Editar'}
              </button>
            </div>
            <p className="sala-meta">{sala.equipamiento || 'Sin equipamiento descrito'}</p>

            {editandoId === sala.id && (
              <div style={{ marginTop: 12, borderTop: '1px solid #f0eef3', paddingTop: 12 }}>
                <div className="field">
                  <label>Equipamiento (texto descriptivo)</label>
                  <input type="text" value={borrador.equipamiento} onChange={(e) => setBorrador({ ...borrador, equipamiento: e.target.value })} />
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

                <button className="btn btn-secondary btn-block" onClick={() => guardar(sala.id)}>Guardar</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
