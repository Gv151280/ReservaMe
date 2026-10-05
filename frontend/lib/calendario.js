// Genera eventos de calendario a partir de una reserva.
// Funciona con Outlook/Microsoft 365 (archivo .ics y enlace web) y con Google Calendar.

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// Formato UTC requerido por iCalendar: 20261005T143000Z
function fechaUTC(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

// Escapa caracteres especiales del formato iCalendar.
function escaparIcs(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function construirDatosEvento(reserva) {
  const sala = reserva.sala?.nombre || 'Sala';
  return {
    titulo: `Reserva: ${sala}`,
    descripcion: `Sala: ${sala}\nTipo: ${reserva.tipoUso === 'clase' ? 'Clase' : 'Reunión / otro'}`,
    ubicacion: sala,
    inicio: new Date(reserva.fechaInicio),
    fin: new Date(reserva.fechaFin),
  };
}

export function generarIcs(reserva) {
  const e = construirDatosEvento(reserva);
  const ahoraUTC = fechaUTC(new Date().toISOString());
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ReservaMe//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:reserva-${reserva.id}@reservame`,
    `DTSTAMP:${ahoraUTC}`,
    `DTSTART:${fechaUTC(e.inicio)}`,
    `DTEND:${fechaUTC(e.fin)}`,
    `SUMMARY:${escaparIcs(e.titulo)}`,
    `DESCRIPTION:${escaparIcs(e.descripcion)}`,
    `LOCATION:${escaparIcs(e.ubicacion)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lineas.join('\r\n');
}

export function descargarIcs(reserva) {
  const blob = new Blob([generarIcs(reserva)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reserva-${reserva.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Enlace que abre Outlook en la web con el evento ya cargado para guardar.
export function urlOutlook(reserva) {
  const e = construirDatosEvento(reserva);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.titulo,
    body: e.descripcion,
    location: e.ubicacion,
    startdt: e.inicio.toISOString(),
    enddt: e.fin.toISOString(),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Enlace de Google Calendar (por si algún docente lo usa).
export function urlGoogle(reserva) {
  const e = construirDatosEvento(reserva);
  const f = (d) => fechaUTC(d);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    details: e.descripcion,
    location: e.ubicacion,
    dates: `${f(e.inicio)}/${f(e.fin)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
