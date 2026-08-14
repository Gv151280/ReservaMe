// Igual lógica que el prototipo interactivo: bloques de 45 min para "Clase"
// entre horaInicio y horaSalidaEstudiantes; "Reunión/otro" acepta cualquier
// horario libre entre horaInicio y horaSalidaProfesores.

const DURACION_BLOQUE_MIN = 45;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function minutesToHHMM(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function hhmmToMinutes(str) {
  const [h, m] = String(str).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// cfg: { abierto, horaInicio, horaSalidaEstudiantes, horaSalidaProfesores } (minutos desde 00:00)
function bloquesDelDia(cfg) {
  if (!cfg || !cfg.abierto) return [];
  const bloques = [];
  let start = cfg.horaInicio;
  while (start + DURACION_BLOQUE_MIN <= cfg.horaSalidaEstudiantes) {
    bloques.push({ start, end: start + DURACION_BLOQUE_MIN });
    start += DURACION_BLOQUE_MIN;
  }
  return bloques;
}

// Dado un horario de config y un rango en minutos [inicioMin, finMin), determina
// si ese rango corresponde exactamente a 1 o 2 bloques consecutivos válidos
// (45 o 90 min, alineados al horario institucional del día).
function esRangoDeClaseValido(cfg, inicioMin, finMin) {
  const duracion = finMin - inicioMin;
  if (duracion !== 45 && duracion !== 90) return false;
  const bloques = bloquesDelDia(cfg);
  return bloques.some((b) => {
    if (duracion === 45) return b.start === inicioMin && b.end === finMin;
    const siguiente = bloques.find((x) => x.start === b.end);
    return b.start === inicioMin && siguiente && siguiente.end === finMin;
  });
}

function dentroDeRangoReunion(cfg, inicioMin, finMin) {
  return inicioMin >= cfg.horaInicio && finMin <= cfg.horaSalidaProfesores;
}

// Convierte una fecha (Date, en horario local del servidor) a minutos desde medianoche.
function minutosDelDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

module.exports = {
  DURACION_BLOQUE_MIN,
  minutesToHHMM,
  hhmmToMinutes,
  bloquesDelDia,
  esRangoDeClaseValido,
  dentroDeRangoReunion,
  minutosDelDia,
};
