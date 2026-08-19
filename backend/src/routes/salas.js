const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { bloquesDelDia } = require('../lib/horarioBloques');

const router = express.Router();

function inicioFinDelDia(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
  const fin = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { inicio, fin };
}

async function horarioDelDia(colegioId, fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay();
  return prisma.horarioInstitucional.findUnique({
    where: { colegioId_diaSemana: { colegioId, diaSemana } },
    include: { bloques: true },
  });
}

// GET /salas -> lista salas activas del colegio del usuario, con disponibilidad resumida de hoy.
router.get('/', requireAuth, async (req, res) => {
  const salas = await prisma.sala.findMany({
    where: { colegioId: req.user.colegioId, activa: true },
    include: { encargado: { select: { id: true, nombre: true } } },
    orderBy: { nombre: 'asc' },
  });

  const hoy = new Date();
  const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const cfgHoy = await horarioDelDia(req.user.colegioId, fechaISO);
  const bloquesHoy = bloquesDelDia(cfgHoy);
  const { inicio, fin } = inicioFinDelDia(fechaISO);

  const salasConDisponibilidad = await Promise.all(
    salas.map(async (sala) => {
      const reservasHoy = await prisma.reserva.findMany({
        where: {
          salaId: sala.id,
          estado: { in: ['pendiente', 'confirmada'] },
          fechaInicio: { lt: fin },
          fechaFin: { gt: inicio },
        },
      });
      const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes();
      const bloquesLibres = bloquesHoy.filter((b) => {
        if (b.end <= ahoraMin) return false; // ya pasó
        const bIni = new Date(hoy); bIni.setHours(0, b.start, 0, 0);
        const bFin = new Date(hoy); bFin.setHours(0, b.end, 0, 0);
        return !reservasHoy.some((r) => r.fechaInicio < bFin && r.fechaFin > bIni);
      });

      return { ...sala, bloquesLibresHoy: bloquesLibres.length, totalBloquesHoy: bloquesHoy.length };
    })
  );

  res.json({ salas: salasConDisponibilidad });
});

// GET /salas/:id/disponibilidad?fecha=YYYY-MM-DD -> horas de clase (ocupado/libre) + horario del día.
router.get('/:id/disponibilidad', requireAuth, async (req, res) => {
  const fechaISO = req.query.fecha;
  if (!fechaISO) return res.status(400).json({ error: 'Falta el parámetro fecha (YYYY-MM-DD).' });

  const sala = await prisma.sala.findFirst({ where: { id: req.params.id, colegioId: req.user.colegioId } });
  if (!sala) return res.status(404).json({ error: 'Sala no encontrada.' });

  const cfg = await horarioDelDia(req.user.colegioId, fechaISO);
  if (!cfg || !cfg.abierto) {
    return res.json({ abierto: false, bloques: [], horario: cfg || null });
  }

  const bloques = bloquesDelDia(cfg);
  const { inicio, fin } = inicioFinDelDia(fechaISO);
  const reservas = await prisma.reserva.findMany({
    where: {
      salaId: sala.id,
      estado: { in: ['pendiente', 'confirmada'] },
      fechaInicio: { lt: fin },
      fechaFin: { gt: inicio },
    },
  });

  const [y, m, d] = fechaISO.split('-').map(Number);
  const bloquesConEstado = bloques.map((b) => {
    const bIni = new Date(y, m - 1, d, 0, b.start, 0, 0);
    const bFin = new Date(y, m - 1, d, 0, b.end, 0, 0);
    const ocupado = reservas.some((r) => r.fechaInicio < bFin && r.fechaFin > bIni);
    const pasado = bFin <= new Date();
    return { ...b, ocupado, pasado };
  });

  res.json({
    abierto: true,
    horario: {
      horaInicio: cfg.horaInicio,
      horaSalidaProfesores: cfg.horaSalidaProfesores,
    },
    bloques: bloquesConEstado,
  });
});

// POST /salas [admin]
router.post('/', requireAuth, requireRole('administrador'), async (req, res) => {
  const { nombre, capacidad, equipamiento, modoReserva, encargadoId } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  if (modoReserva === 'con_aprobacion' && !encargadoId) {
    return res.status(400).json({ error: 'Una sala con aprobación requiere un encargado asignado.' });
  }
  const sala = await prisma.sala.create({
    data: {
      colegioId: req.user.colegioId,
      nombre,
      capacidad: capacidad ?? null,
      equipamiento: equipamiento ?? null,
      modoReserva: modoReserva || 'autoservicio',
      encargadoId: encargadoId ?? null,
    },
  });
  res.status(201).json({ sala });
});

// PATCH /salas/:id [admin]
router.patch('/:id', requireAuth, requireRole('administrador'), async (req, res) => {
  const sala = await prisma.sala.findFirst({ where: { id: req.params.id, colegioId: req.user.colegioId } });
  if (!sala) return res.status(404).json({ error: 'Sala no encontrada.' });

  const { nombre, capacidad, equipamiento, modoReserva, encargadoId, activa } = req.body;
  const nuevoModo = modoReserva ?? sala.modoReserva;
  const nuevoEncargado = encargadoId === undefined ? sala.encargadoId : encargadoId;
  if (nuevoModo === 'con_aprobacion' && !nuevoEncargado) {
    return res.status(400).json({ error: 'Una sala con aprobación requiere un encargado asignado.' });
  }

  const actualizada = await prisma.sala.update({
    where: { id: sala.id },
    data: {
      nombre: nombre ?? sala.nombre,
      capacidad: capacidad === undefined ? sala.capacidad : capacidad,
      equipamiento: equipamiento === undefined ? sala.equipamiento : equipamiento,
      modoReserva: nuevoModo,
      encargadoId: nuevoEncargado,
      activa: activa === undefined ? sala.activa : activa,
    },
  });
  res.json({ sala: actualizada });
});

module.exports = router;
