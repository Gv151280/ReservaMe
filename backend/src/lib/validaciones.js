// Todas las reglas de negocio del PRD/doc técnico validadas del lado del
// servidor — nunca confiar solo en lo que oculta/muestra el frontend
// (doc técnico, sección 4: "un usuario podría saltarse el frontend llamando
// la API directo").

const prisma = require('../db');
const { esRangoDeClaseValido, dentroDeRangoReunion, minutosDelDia } = require('./horarioBloques');

const ANTICIPACION_MAX_DIAS = 30;

function errorHttp(status, mensaje) {
  return Object.assign(new Error(mensaje), { status });
}

// Regla: no se puede reservar una sala/horario que ya está confirmada o
// pendiente en ese rango. Se valida en el momento de crear (no solo al
// mostrar el calendario), para el caso de dos personas reservando casi
// simultáneamente (PRD, sección 6).
async function validarSinSolape(salaId, fechaInicio, fechaFin, excluirReservaId) {
  const solapadas = await prisma.reserva.findMany({
    where: {
      salaId,
      id: excluirReservaId ? { not: excluirReservaId } : undefined,
      estado: { in: ['pendiente', 'confirmada'] },
      fechaInicio: { lt: fechaFin },
      fechaFin: { gt: fechaInicio },
    },
    select: { id: true },
  });
  if (solapadas.length > 0) {
    throw errorHttp(409, 'Ese horario ya no está disponible. Elige otro bloque u horario.');
  }
}

// Regla: no se puede reservar con más de 1 mes de anticipación (ni en el pasado).
function validarAnticipacion(fechaInicio) {
  const ahora = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + ANTICIPACION_MAX_DIAS);
  if (fechaInicio < ahora) {
    throw errorHttp(400, 'No puedes reservar una fecha/hora que ya pasó.');
  }
  if (fechaInicio > limite) {
    throw errorHttp(400, `Solo puedes reservar hasta ${ANTICIPACION_MAX_DIAS} días hacia adelante.`);
  }
}

// Regla: tipo_uso determina las reglas de duración (PRD sección 5.1), y ahora
// también depende del horario institucional configurable por día.
async function validarTipoUsoYHorario(colegioId, tipoUso, fechaInicio, fechaFin) {
  if (fechaFin <= fechaInicio) {
    throw errorHttp(400, 'La hora de término debe ser posterior al inicio.');
  }
  if (
    fechaInicio.getFullYear() !== fechaFin.getFullYear() ||
    fechaInicio.getMonth() !== fechaFin.getMonth() ||
    fechaInicio.getDate() !== fechaFin.getDate()
  ) {
    throw errorHttp(400, 'La reserva debe empezar y terminar el mismo día.');
  }

  const diaSemana = fechaInicio.getDay();
  const cfg = await prisma.horarioInstitucional.findUnique({
    where: { colegioId_diaSemana: { colegioId, diaSemana } },
    include: { bloques: true },
  });
  if (!cfg || !cfg.abierto) {
    throw errorHttp(400, 'El colegio no tiene jornada ese día, no se puede reservar.');
  }

  const inicioMin = minutosDelDia(fechaInicio);
  const finMin = minutosDelDia(fechaFin);

  if (tipoUso === 'clase') {
    if (!esRangoDeClaseValido(cfg, inicioMin, finMin)) {
      throw errorHttp(
        400,
        'Para reservas de "Clase" el horario debe calzar exactamente con una hora de clase, o con dos horas consecutivas sin recreo entre medio, según el horario institucional de ese día.'
      );
    }
  } else if (tipoUso === 'reunion_otro') {
    const cfgMin = { horaInicio: cfg.horaInicio, horaSalidaProfesores: cfg.horaSalidaProfesores };
    if (!dentroDeRangoReunion(cfgMin, inicioMin, finMin)) {
      throw errorHttp(
        400,
        `Para "Reunión/otro uso" el horario debe estar entre las ${fmt(cfg.horaInicio)} y las ${fmt(
          cfg.horaSalidaProfesores
        )} (salida de encargados/profesores ese día).`
      );
    }
  } else {
    throw errorHttp(400, 'tipo_uso inválido: debe ser "clase" o "reunion_otro".');
  }
}

function fmt(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

// Regla: solo el encargado de la sala (o un Administrador) puede aprobar/rechazar.
function puedeGestionarSala(usuario, sala) {
  const esAdmin = usuario.roles.includes('administrador');
  const esEncargado = sala.encargadoId === usuario.id;
  return esAdmin || esEncargado;
}

// Regla: un usuario solo puede cancelar sus propias reservas (o un Administrador cualquiera).
function puedeCancelar(usuario, reserva) {
  const esAdmin = usuario.roles.includes('administrador');
  return esAdmin || reserva.usuarioId === usuario.id;
}

module.exports = {
  ANTICIPACION_MAX_DIAS,
  errorHttp,
  validarSinSolape,
  validarAnticipacion,
  validarTipoUsoYHorario,
  puedeGestionarSala,
  puedeCancelar,
};
