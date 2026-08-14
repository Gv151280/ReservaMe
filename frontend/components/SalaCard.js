import Link from 'next/link';
import StickerIcon, { GLYPH } from './StickerIcon';

const TONOS_POR_NOMBRE = { 'Sala de Proyectos': 'blue', CRA: 'green' };
const GLYPH_POR_NOMBRE = { 'Sala de Proyectos': GLYPH.proyector, CRA: GLYPH.libro };

export default function SalaCard({ sala }) {
  const tono = TONOS_POR_NOMBRE[sala.nombre] || 'purple';
  const glyph = GLYPH_POR_NOMBRE[sala.nombre] || GLYPH.calendario;

  return (
    <Link href={`/salas/${sala.id}`} className="sala-card">
      <StickerIcon tono={tono} glyph={glyph} />
      <div className="sala-info">
        <h3>{sala.nombre}</h3>
        <p className="sala-meta">
          Capacidad {sala.capacidad ?? '—'} · {sala.equipamiento || 'Sin equipamiento registrado'}
        </p>
        {sala.bloquesLibresHoy > 0 ? (
          <span className="badge badge-libre">
            <span className="dot" /> {sala.bloquesLibresHoy} bloques libres hoy
          </span>
        ) : (
          <span className="badge badge-ocupado">
            <span className="dot" /> Sin cupos hoy
          </span>
        )}{' '}
        {sala.modoReserva === 'con_aprobacion' ? (
          <span className="badge badge-encargado">Requiere aprobación</span>
        ) : (
          <span className="badge badge-libre">Autoservicio</span>
        )}
      </div>
      <span className="chevron">›</span>
    </Link>
  );
}
