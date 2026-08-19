// Los bloques de "Clase" ya NO se calculan automáticamente cada 45 min — vienen
// directo de la lista de horas de clase (BloqueClase) que el Administrador
// configuró para ese día. Los recreos son, simplemente, los espacios de tiempo
// que quedan entre una hora y la siguiente.

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

// cfg: { abierto, bloques: [{horaInicio, horaFin}, ...] }
// Devuelve las horas de clase del día, ordenadas por hora de inicio.
function bloquesDelDia(cfg) {
  if (!cfg || !cfg.abierto || !Array.isArray(cfg.bloques)) return [];
  return cfg.bloques
    .slice()
    .sort((a, b) => a.horaInicio - b.horaInicio)
    .map((b) => ({ start: b.horaInicio, end: b.horaFin }));
}

// Válido si [inicioMin, finMin) calza EXACTO con una hora de clase (duración simple),
// o con dos horas consecutivas sin recreo entre ellas (duración doble, ej. 90 min).
function esRangoDeClaseValido(cfg, inicioMin, finMin) {
  const bloques = bloquesDelDia(cfg);
  return bloques.some((b) => {
    if (b.start === inicioMin && b.end === finMin) return true; // 1 hora exacta
    if (b.start !== inicioMin) return false;
    const siguiente = bloques.find((x) => x.start === b.end); // sin recreo entre medio
    return siguiente && siguiente.end === finMin; // 2 horas consecutivas exactas
  });
}

function dentroDeRangoReunion(cfg, inicioMin, finMin) {
  return inicioMin >= cfg.horaInicio && finMin <= cfg.horaSalidaProfesores;
}

function minutosDelDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

module.exports = {
  minutesToHHMM,
  hhmmToMinutes,
  bloquesDelDia,
  esRangoDeClaseValido,
  dentroDeRangoReunion,
  minutosDelDia,
};
