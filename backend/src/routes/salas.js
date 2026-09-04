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
      const bloqueosHoy = await prisma.bloqueo.findMany({
        where: { salaId: sala.id, activo: true, fechaInicio: { lt: fin }, fechaFin: { gt: inicio } },
      });
      const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes();
      const bloquesLibres = bloquesHoy.filter((b) => {
        if (b.end <= ahoraMin) return false;
        const bIni = new Date(hoy); bIni.setHours(0, b.start, 0, 0);
        const bFin = new Date(hoy); bFin.setHours(0, b.end, 0, 0);
        const ocupadoPorReserva = reservasHoy.some((r) => r.fechaInicio < bFin && r.fechaFin > bIni);
        const ocupadoPorBloqueo = bloqueosHoy.some((bl) => bl.fechaInicio < bFin && bl.fechaFin > bIni);
        return !ocupadoPorReserva && !ocupadoPorBloqueo;
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
  const bloqueos = await prisma.bloqueo.findMany({
    where: { salaId: sala.id, activo: true, fechaInicio: { lt: fin }, fechaFin: { gt: inicio } },
  });

  const [y, m, d] = fechaISO.split('-').map(Number);
  const bloquesConEstado = bloques.map((b) => {
    const bIni = new Date(y, m - 1, d, 0, b.start, 0, 0);
    const bFin = new Date(y, m - 1, d, 0, b.end, 0, 0);
    const bloqueoQueAplica = bloqueos.find((bl) => bl.fechaInicio < bFin && bl.fechaFin > bIni);
    const ocupado = Boolean(bloqueoQueAplica) || reservas.some((r) => r.fechaInicio < bFin && r.fechaFin > bIni);
    const pasado = bFin <= new Date();
    return { ...b, ocupado, pasado, motivoBloqueo: bloqueoQueAplica ? bloqueoQueAplica.motivo : null };
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

function normalizarItemsEquipamiento(items) {
  if (!Array.isArray(items)) return undefined;
  return items
    .filter((it) => it && typeof it.nombre === 'string' && it.nombre.trim())
    .map((it) => ({
      nombre: it.nombre.trim(),
      tieneCantidad: Boolean(it.tieneCantidad),
      cantidadMaxima: it.tieneCantidad && it.cantidadMaxima ? Number(it.cantidadMaxima) : null,
    }));
}

// POST /salas [admin]
router.post('/', requireAuth, requireRole('administrador'), async (req, res) => {
  const { nombre, capacidad, equipamiento, encargadoId, itemsEquipamiento } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
  const sala = await prisma.sala.create({
    data: {
      colegioId: req.user.colegioId,
      nombre,
      capacidad: capacidad ?? null,
      equipamiento: equipamiento ?? null,
      encargadoId: encargadoId ?? null,
      itemsEquipamiento: normalizarItemsEquipamiento(itemsEquipamiento) ?? [],
    },
  });
  res.status(201).json({ sala });
});

// PATCH /salas/:id [admin: todo el sala; encargado de esa sala: SOLO itemsEquipamiento/equipamiento]
router.patch('/:id', requireAuth, async (req, res) => {
  const sala = await prisma.sala.findFirst({ where: { id: req.params.id, colegioId: req.user.colegioId } });
  if (!sala) return res.status(404).json({ error: 'Sala no encontrada.' });

  const esAdmin = req.user.roles.includes('administrador');
  const esEncargadoDeEstaSala = sala.encargadoId === req.user.id;
  if (!esAdmin && !esEncargadoDeEstaSala) {
    return res.status(403).json({ error: 'No tienes permiso para editar esta sala.' });
  }

  const { nombre, capacidad, equipamiento, encargadoId, activa, itemsEquipamiento } = req.body;
  const itemsNormalizados = normalizarItemsEquipamiento(itemsEquipamiento);

  // Un Encargado (no admin) solo puede tocar el equipamiento de su sala — el resto
  // de los campos (nombre, capacidad, quién es el encargado, activa) son solo del Admin.
  const data = esAdmin
    ? {
        nombre: nombre ?? sala.nombre,
        capacidad: capacidad === undefined ? sala.capacidad : capacidad,
        equipamiento: equipamiento === undefined ? sala.equipamiento : equipamiento,
        encargadoId: encargadoId === undefined ? sala.encargadoId : encargadoId,
        activa: activa === undefined ? sala.activa : activa,
        itemsEquipamiento: itemsNormalizados === undefined ? sala.itemsEquipamiento : itemsNormalizados,
      }
    : {
        equipamiento: equipamiento === undefined ? sala.equipamiento : equipamiento,
        itemsEquipamiento: itemsNormalizados === undefined ? sala.itemsEquipamiento : itemsNormalizados,
      };

  const actualizada = await prisma.sala.update({ where: { id: sala.id }, data });
  res.json({ sala: actualizada });
});

module.exports = router;
