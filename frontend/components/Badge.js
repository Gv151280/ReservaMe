const LABELS = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  clase: 'Clase',
  reunion_otro: 'Reunión/otro',
};

export default function Badge({ tipo, children }) {
  const cls = tipo === 'reunion_otro' ? 'badge-reunion' : `badge-${tipo}`;
  return <span className={`badge ${cls}`}>{children || LABELS[tipo] || tipo}</span>;
}
