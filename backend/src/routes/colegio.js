const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const colegio = await prisma.colegio.findUnique({ where: { id: req.user.colegioId } });
  res.json({ colegio });
});

router.patch('/', requireAuth, requireRole('administrador'), async (req, res) => {
  const { nombre, logoUrl } = req.body;
  const colegio = await prisma.colegio.update({
    where: { id: req.user.colegioId },
    data: { nombre: nombre ?? undefined, logoUrl: logoUrl === undefined ? undefined : logoUrl || null },
  });
  res.json({ colegio });
});

module.exports = router;
