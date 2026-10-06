const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validarAnticipacion, puedeRevertirBloqueo } = require('../lib/validaciones');
const { registrarAuditoria } = require('../lib/auditoria');
const { crearNotificacion } = require('../lib/notificaciones');

const router = express.Router();

const fmtFechaHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fmtHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// GET /bloqueos?activo=true -> lista bloqueos del colegio (para el panel de gestión
// y para que el calendario de disponibilidad los pinte como ocupados).
router.get('/', requireAuth, async (req, res) => {
  const where = { sala: { colegioId: req.user.colegioId } };
  if (req.query.activo !== undefined) where.activo = req.query.activo === 'true';

  const bloqueos = await prisma.bloqueo.findMany({
    where,
    include: { sala: true, creadoPor: { select: { id: true, nombre: true } } },
    orderBy: { fechaInicio: 'desc' },
  });
  res.json({ bloqueos });
});

// POST /bloqueos [directivo o administrador]
// body: { salaId, fechaInicio, fechaFin, motivo }  (motivo obligatorio)
// Al crear el bloqueo, anula las reservas pendientes o confirmadas que se crucen con
// el rango y avisa a cada docente afectado.
router.post('/', requireAuth, requireRole('directivo', 'administrador'), async (req, res) => {
  try {
    const { salaId, fechaInicio, fechaFin, motivo } = req.body;
    if (!salaId || !fechaInicio || !fechaFin || !motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Faltan campos: salaId, fechaInicio, fechaFin y motivo son obligatorios.' });
    }

    const sala = await prisma.sala.findFirst({ where: { id: salaId, colegioId: req.user.colegioId } });
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada.' });

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    if (fin <= inicio) return res.status(400).json({ error: 'La fecha/hora de término debe ser posterior al inicio.' });
    validarAnticipacion(inicio);

    const motivoLimpio = motivo.trim();
    const bloqueo = await prisma.bloqueo.create({
      data: { salaId, creadoPorId: req.user.id, fechaInicio: inicio, fechaFin: fin, motivo: motivoLimpio },
    });

    // Reservas que se cruzan con el bloqueo: no se realizarán.
    const afectadas = await prisma.reserva.findMany({
      where: {
        salaId,
        estado: { in: ['pendiente', 'confirmada'] },
        fechaInicio: { lt: fin },
        fechaFin: { gt: inicio },
      },
      include: { sala: true },
    });

    for (const r of afectadas) {
      await prisma.reserva.update({
        where: { id: r.id },
        data: { estado: 'cancelada', motivoRechazo: `Sala bloqueada: ${motivoLimpio}` },
      });

      const mensaje = `Tu reserva de ${sala.nombre} del ${fmtFechaHora.format(r.fechaInicio)} al ${fmtHora.format(r.fechaFin)} fue anulada porque la sala quedó bloqueada: ${motivoLimpio}. Puedes reservar otro horario.`;
      await crearNotificacion({ reservaId: r.id, destinatarioId: r.usuarioId, canal: 'push', mensaje });
      await crearNotificacion({ reservaId: r.id, destinatarioId: r.usuarioId, canal: 'email', mensaje });

      await registrarAuditoria({
        colegioId: req.user.colegioId,
        usuario: req.user,
        accion: 'reserva.anular',
        entidad: 'reserva',
        entidadId: r.id,
        detalle: { sala: sala.nombre, solicitanteId: r.usuarioId, motivoBloqueo: bloqueo.id },
      });
    }

    await registrarAuditoria({
      colegioId: req.user.colegioId,
      usuario: req.user,
      accion: 'bloqueo.crear',
      entidad: 'bloqueo',
      entidadId: bloqueo.id,
      detalle: { sala: sala.nombre, motivo: motivoLimpio, fechaInicio: inicio, fechaFin: fin, reservasAnuladas: afectadas.length },
    });

    res.status(201).json({ bloqueo, reservasAnuladas: afectadas.length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /bloqueos/:id/revertir [admin: cualquiera; directivo: solo los que él creó]
// Revertir libera la sala para nuevas reservas. Las reservas anuladas no se restauran.
router.patch('/:id/revertir', requireAuth, async (req, res) => {
  try {
    const bloqueo = await prisma.bloqueo.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!bloqueo) return res.status(404).json({ error: 'Bloqueo no encontrado.' });
    if (!puedeRevertirBloqueo(req.user, bloqueo)) {
      return res.status(403).json({ error: 'No tienes permiso para revertir este bloqueo.' });
    }
    if (!bloqueo.activo) return res.status(400).json({ error: 'Este bloqueo ya estaba revertido.' });

    const actualizado = await prisma.bloqueo.update({
      where: { id: bloqueo.id },
      data: { activo: false, revertidoPorId: req.user.id, revertidoEn: new Date() },
    });

    await registrarAuditoria({
      colegioId: req.user.colegioId,
      usuario: req.user,
      accion: 'bloqueo.revertir',
      entidad: 'bloqueo',
      entidadId: bloqueo.id,
      detalle: { sala: bloqueo.sala?.nombre, motivo: bloqueo.motivo },
    });

    res.json({ bloqueo: actualizado });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
