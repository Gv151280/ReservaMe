const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { hhmmToMinutes } = require('../lib/horarioBloques');

const router = express.Router();

// GET /horario -> las 7 filas (domingo a sábado) del colegio del usuario. Cualquier usuario
// autenticado puede leerlo (lo necesita el formulario de reserva), solo el admin lo edita.
router.get('/', requireAuth, async (req, res) => {
  const dias = await prisma.horarioInstitucional.findMany({
    where: { colegioId: req.user.colegioId },
    orderBy: { diaSemana: 'asc' },
  });
  res.json({ dias });
});

// PATCH /horario/:diaSemana [admin]  { abierto?, horaInicio?, horaSalidaEstudiantes?, horaSalidaProfesores? }
// Las horas pueden venir como "HH:MM" (se convierten a minutos) o ya como número de minutos.
router.patch('/:diaSemana', requireAuth, requireRole('administrador'), async (req, res) => {
  const diaSemana = Number(req.params.diaSemana);
  if (Number.isNaN(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    return res.status(400).json({ error: 'diaSemana debe ser 0 (domingo) a 6 (sábado).' });
  }

  const actual = await prisma.horarioInstitucional.findUnique({
    where: { colegioId_diaSemana: { colegioId: req.user.colegioId, diaSemana } },
  });
  if (!actual) return res.status(404).json({ error: 'No hay configuración para ese día. Ejecuta el seed primero.' });

  const toMin = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    return typeof v === 'string' && v.includes(':') ? hhmmToMinutes(v) : Number(v);
  };

  const horaInicio = toMin(req.body.horaInicio, actual.horaInicio);
  const horaSalidaEstudiantes = toMin(req.body.horaSalidaEstudiantes, actual.horaSalidaEstudiantes);
  const horaSalidaProfesores = toMin(req.body.horaSalidaProfesores, actual.horaSalidaProfesores);
  const abierto = req.body.abierto === undefined ? actual.abierto : Boolean(req.body.abierto);

  if (abierto && horaInicio >= horaSalidaEstudiantes) {
    return res.status(400).json({ error: 'El inicio de jornada debe ser antes que la salida de estudiantes.' });
  }
  if (abierto && horaSalidaProfesores < horaSalidaEstudiantes) {
    return res.status(400).json({ error: 'La salida de profesores no puede ser antes que la de estudiantes.' });
  }

  const actualizado = await prisma.horarioInstitucional.update({
    where: { colegioId_diaSemana: { colegioId: req.user.colegioId, diaSemana } },
    data: { abierto, horaInicio, horaSalidaEstudiantes, horaSalidaProfesores },
  });
  res.json({ dia: actualizado });
});

module.exports = router;
