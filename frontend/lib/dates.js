function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sumarDias(fechaISO, delta) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function fmtFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const texto = dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function minutesToHHMM(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function fmtHora(isoDateTimeString) {
  const dt = new Date(isoDateTimeString);
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// Combina una fecha (YYYY-MM-DD) con minutos-del-día en un Date local, y lo
// entrega como ISO string (con offset local) para mandarlo tal cual a la API.
export function combinarFechaMinutos(fechaISO, minutosDelDia) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  dt.setMinutes(minutosDelDia);
  return dt.toISOString();
}
