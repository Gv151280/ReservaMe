const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { validarAnticipacion, puedeRevertirBloqueo } = require('../lib/validaciones');

const router = express.Router();

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

    const bloqueo = await prisma.bloqueo.create({
      data: { salaId, creadoPorId: req.user.id, fechaInicio: inicio, fechaFin: fin, motivo: motivo.trim() },
    });
    res.status(201).json({ bloqueo });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /bloqueos/:id/revertir [admin: cualquiera; directivo: solo los que él creó]
router.patch('/:id/revertir', requireAuth, async (req, res) => {
  const bloqueo = await prisma.bloqueo.findUnique({ where: { id: req.params.id } });
  if (!bloqueo) return res.status(404).json({ error: 'Bloqueo no encontrado.' });
  if (!puedeRevertirBloqueo(req.user, bloqueo)) {
    return res.status(403).json({ error: 'No tienes permiso para revertir este bloqueo.' });
  }
  if (!bloqueo.activo) return res.status(400).json({ error: 'Este bloqueo ya estaba revertido.' });

  const actualizado = await prisma.bloqueo.update({
    where: { id: bloqueo.id },
    data: { activo: false, revertidoPorId: req.user.id, revertidoEn: new Date() },
  });
  res.json({ bloqueo: actualizado });
});

module.exports = router;
