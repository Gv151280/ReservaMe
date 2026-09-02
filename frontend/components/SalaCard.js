import Link from 'next/link';
import StickerIcon, { GLYPH } from './StickerIcon';

const TONOS_POR_NOMBRE = { 'Sala de Proyectos': 'blue', CRA: 'green' };
const ICONO_POR_NOMBRE = { 'Sala de Proyectos': 'proyector', CRA: 'libro' };

export default function SalaCard({ sala }) {
  const tono = TONOS_POR_NOMBRE[sala.nombre] || 'purple';
  const glyph = GLYPH[ICONO_POR_NOMBRE[sala.nombre]] || GLYPH.calendario;
  const libres = sala.bloquesLibresHoy ?? 0;

  return (
    <Link href={`/reservar?salaId=${sala.id}`} className="sala-card">
      <StickerIcon tono={tono} glyph={glyph} />
      <div className="sala-info">
        <h3>{sala.nombre}</h3>
        <p className="sala-meta">Capacidad {sala.capacidad ?? '—'} · {sala.equipamiento || 'Sin equipamiento'}</p>
        {libres > 0 ? (
          <span className="badge badge-libre"><span className="dot" /> {libres} bloques libres hoy</span>
        ) : (
          <span className="badge badge-ocupado"><span className="dot" /> Sin cupos hoy</span>
        )}
      </div>
      <span className="chevron">›</span>
    </Link>
  );
}
