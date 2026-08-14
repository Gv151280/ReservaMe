const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /notificaciones/mias -> últimas notificaciones del usuario (para la campanita).
router.get('/mias', requireAuth, async (req, res) => {
  const notificaciones = await prisma.notificacion.findMany({
    where: { destinatarioId: req.user.id },
    orderBy: { creadoEn: 'desc' },
    take: 20,
  });
  res.json({ notificaciones });
});

// PATCH /notificaciones/marcar-leidas -> marca todas las propias como leídas (se llama al abrir la campanita).
router.patch('/marcar-leidas', requireAuth, async (req, res) => {
  await prisma.notificacion.updateMany({
    where: { destinatarioId: req.user.id, leida: false },
    data: { leida: true },
  });
  res.json({ ok: true });
});

module.exports = router;
