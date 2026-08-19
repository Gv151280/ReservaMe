const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { hhmmToMinutes } = require('../lib/horarioBloques');

const router = express.Router();

// GET /horario -> las 7 filas (domingo a sábado) del colegio del usuario, con sus
// horas de clase (bloques) ordenadas. Cualquier usuario autenticado puede leerlo
// (lo necesita el formulario de reserva), solo el admin lo edita.
router.get('/', requireAuth, async (req, res) => {
  const dias = await prisma.horarioInstitucional.findMany({
    where: { colegioId: req.user.colegioId },
    include: { bloques: { orderBy: { horaInicio: 'asc' } } },
    orderBy: { diaSemana: 'asc' },
  });
  res.json({ dias });
});

function toMin(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  return typeof v === 'string' && v.includes(':') ? hhmmToMinutes(v) : Number(v);
}

// PATCH /horario/:diaSemana [admin]
// body: { abierto?, horaInicio?, horaSalidaProfesores?, bloques?: [{horaInicio, horaFin}, ...] }
// Las horas pueden venir como "HH:MM" o como minutos. `bloques`, si viene, REEMPLAZA
// por completo la lista de horas de clase de ese día (se borran las anteriores).
router.patch('/:diaSemana', requireAuth, requireRole('administrador'), async (req, res) => {
  const diaSemana = Number(req.params.diaSemana);
  if (Number.isNaN(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return res.status(400).json({ error: 'diaSemana debe ser 0 (domingo) a 6 (sábado).' });
  }

  const actual = await prisma.horarioInstitucional.findUnique({
    where: { colegioId_diaSemana: { colegioId: req.user.colegioId, diaSemana } },
    include: { bloques: true },
  });
  if (!actual) return res.status(404).json({ error: 'No hay configuración para ese día. Ejecuta el seed primero.' });

  const horaInicio = toMin(req.body.horaInicio, actual.horaInicio);
  const horaSalidaProfesores = toMin(req.body.horaSalidaProfesores, actual.horaSalidaProfesores);
  const abierto = req.body.abierto === undefined ? actual.abierto : Boolean(req.body.abierto);

  let bloquesNuevos = null;
  if (Array.isArray(req.body.bloques)) {
    try {
      bloquesNuevos = req.body.bloques.map((b, i) => {
        const hi = toMin(b.horaInicio, null);
        const hf = toMin(b.horaFin, null);
        if (hi === null || hf === null || Number.isNaN(hi) || Number.isNaN(hf)) {
          throw Object.assign(new Error(`La hora de clase #${i + 1} tiene un horario inválido.`), { status: 400 });
        }
        if (hf <= hi) {
          throw Object.assign(new Error(`La hora de clase #${i + 1}: el término debe ser posterior al inicio.`), { status: 400 });
        }
        return { horaInicio: hi, horaFin: hf };
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
    bloquesNuevos.sort((a, b) => a.horaInicio - b.horaInicio);
    for (let i = 1; i < bloquesNuevos.length; i++) {
      if (bloquesNuevos[i].horaInicio < bloquesNuevos[i - 1].horaFin) {
        return res.status(400).json({ error: 'Dos horas de clase no pueden superponerse entre sí.' });
      }
    }
  }

  if (abierto && horaSalidaProfesores < horaInicio) {
    return res.status(400).json({ error: 'La salida de encargados/profesores no puede ser antes del inicio de jornada.' });
  }

  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const dia = await tx.horarioInstitucional.update({
        where: { colegioId_diaSemana: { colegioId: req.user.colegioId, diaSemana } },
        data: { abierto, horaInicio, horaSalidaProfesores },
      });
      if (bloquesNuevos !== null) {
        await tx.bloqueClase.deleteMany({ where: { horarioId: dia.id } });
        if (bloquesNuevos.length > 0) {
          await tx.bloqueClase.createMany({
            data: bloquesNuevos.map((b) => ({ horarioId: dia.id, ...b })),
          });
        }
      }
      return tx.horarioInstitucional.findUnique({
        where: { id: dia.id },
        include: { bloques: { orderBy: { horaInicio: 'asc' } } },
      });
    });
    res.json({ dia: actualizado });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
