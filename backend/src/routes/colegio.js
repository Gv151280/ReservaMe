const express = require('express');
const jwt = require('jsonwebtoken');
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

// GET /colegio/logo-ticket -> entrega un ticket firmado, válido 2 minutos,
// que autoriza la subida del logo desde la ruta interna del frontend en Vercel.
router.get('/logo-ticket', requireAuth, requireRole('administrador'), (req, res) => {
  const ticket = jwt.sign(
    { colegioId: req.user.colegioId, purpose: 'upload-logo' },
    process.env.JWT_SECRET,
    { expiresIn: '2m' }
  );
  res.json({ ticket });
});

module.exports = router;
