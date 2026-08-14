const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  errorHttp,
  validarSinSolape,
  validarAnticipacion,
  validarTipoUsoYHorario,
  puedeGestionarSala,
  puedeCancelar,
} = require('../lib/validaciones');
const {
  notificarReservaPendiente,
  notificarReservaConfirmada,
  notificarReservaAprobada,
  notificarReservaRechazada,
} = require('../lib/notificaciones');

const router = express.Router();

// GET /reservas/mias -> reservas del usuario actual.
router.get('/mias', requireAuth, async (req, res) => {
  const reservas = await prisma.reserva.findMany({
    where: { usuarioId: req.user.id },
    include: { sala: true },
    orderBy: { fechaInicio: 'desc' },
  });
  res.json({ reservas });
});

// GET /reservas/pendientes [encargado de alguna sala, o admin] -> pendientes de sus salas.
router.get('/pendientes', requireAuth, async (req, res) => {
  const esAdmin = req.user.roles.includes('administrador');
  const salas = await prisma.sala.findMany({
    where: esAdmin
      ? { colegioId: req.user.colegioId }
      : { colegioId: req.user.colegioId, encargadoId: req.user.id },
    select: { id: true },
  });
  const salaIds = salas.map((s) => s.id);
  if (salaIds.length === 0) return res.json({ reservas: [] });

  const reservas = await prisma.reserva.findMany({
    where: { salaId: { in: salaIds }, estado: 'pendiente' },
    include: { sala: true, usuario: { select: { id: true, nombre: true, emailInstitucional: true } } },
    orderBy: { fechaInicio: 'asc' },
  });
  res.json({ reservas });
});

// POST /reservas -> crea la reserva validando TODAS las reglas de negocio del backend.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { salaId, tipoUso, fechaInicio, fechaFin } = req.body;
    if (!salaId || !tipoUso || !fechaInicio || !fechaFin) {
      throw errorHttp(400, 'Faltan campos: salaId, tipoUso, fechaInicio, fechaFin.');
    }

    const sala = await prisma.sala.findFirst({ where: { id: salaId, colegioId: req.user.colegioId, activa: true } });
    if (!sala) throw errorHttp(404, 'Sala no encontrada o inactiva.');

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    validarAnticipacion(inicio);
    await validarTipoUsoYHorario(req.user.colegioId, tipoUso, inicio, fin);
    await validarSinSolape(salaId, inicio, fin);

    const estado = sala.modoReserva === 'autoservicio' ? 'confirmada' : 'pendiente';

    const reserva = await prisma.reserva.create({
      data: {
        salaId,
        usuarioId: req.user.id,
        tipoUso,
        fechaInicio: inicio,
        fechaFin: fin,
        estado,
      },
    });

    if (estado === 'confirmada') {
      await notificarReservaConfirmada({ reserva, sala, usuarioId: req.user.id });
    } else {
      await notificarReservaPendiente({ reserva, sala, solicitante: req.user });
    }

    res.status(201).json({ reserva });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /reservas/:id/aprobar [encargado de la sala o admin]
router.patch('/:id/aprobar', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeGestionarSala(req.user, reserva.sala)) throw errorHttp(403, 'No tienes permiso para gestionar esta sala.');
    if (reserva.estado !== 'pendiente') throw errorHttp(400, 'Solo se pueden aprobar reservas pendientes.');

    // Revalidar solapamiento al momento de aprobar por si algo cambió mientras esperaba.
    await validarSinSolape(reserva.salaId, reserva.fechaInicio, reserva.fechaFin, reserva.id);

    const actualizada = await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'confirmada' } });
    await notificarReservaAprobada({ reserva: actualizada, sala: reserva.sala });
    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /reservas/:id/rechazar [encargado de la sala o admin]  { motivo?: string }
router.patch('/:id/rechazar', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeGestionarSala(req.user, reserva.sala)) throw errorHttp(403, 'No tienes permiso para gestionar esta sala.');
    if (reserva.estado !== 'pendiente') throw errorHttp(400, 'Solo se pueden rechazar reservas pendientes.');

    const actualizada = await prisma.reserva.update({
      where: { id: reserva.id },
      data: { estado: 'rechazada', motivoRechazo: req.body.motivo || null },
    });
    await notificarReservaRechazada({ reserva: actualizada, sala: reserva.sala });
    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /reservas/:id -> cancelar (propia, o admin).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeCancelar(req.user, reserva)) throw errorHttp(403, 'Solo puedes cancelar tus propias reservas.');
    if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
      throw errorHttp(400, 'Esta reserva ya no se puede cancelar.');
    }

    const actualizada = await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'cancelada' } });
    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
