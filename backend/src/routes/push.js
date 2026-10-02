const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /push/subscribe -> guarda (o actualiza) la suscripción push de este dispositivo.
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Suscripción inválida.' });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { usuarioId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { usuarioId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.json({ ok: true });
});

// DELETE /push/subscribe -> elimina la suscripción de este dispositivo.
router.delete('/subscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Falta endpoint.' });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, usuarioId: req.user.id } });
  res.json({ ok: true });
});

module.exports = router;
