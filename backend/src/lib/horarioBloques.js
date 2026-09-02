// Los bloques de "Clase" vienen directo de la lista de horas de clase
// (BloqueClase) que el Administrador configuró para ese día. Los recreos son
// los espacios de tiempo que quedan entre una hora y la siguiente.
//
// Regla de 90 min (confirmada con el colegio): un profesor puede reservar dos
// horas consecutivas seguidas, AUNQUE haya un recreo (corto o de almuerzo) entre
// medio — la clase se pausa en el recreo y continúa después. La reserva bloquea
// la sala también durante ese recreo (es un solo tramo continuo).

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
// o con DOS horas consecutivas en el orden del día (la que sigue cronológicamente,
// haya o no recreo entre ellas) — duración doble.
function esRangoDeClaseValido(cfg, inicioMin, finMin) {
  const bloques = bloquesDelDia(cfg);
  return bloques.some((b, i) => {
    if (b.start === inicioMin && b.end === finMin) return true; // 1 hora exacta
    if (b.start !== inicioMin) return false;
    const siguiente = bloques[i + 1]; // la hora que le sigue en el día (con o sin recreo entre medio)
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
