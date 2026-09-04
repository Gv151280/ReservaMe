const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// GET /usuarios [admin]
router.get('/', requireAuth, requireRole('administrador'), async (req, res) => {
  const usuarios = await prisma.usuario.findMany({
    where: { colegioId: req.user.colegioId },
    include: { roles: { include: { rol: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json({
    usuarios: usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.emailInstitucional,
      activo: u.activo,
      roles: u.roles.map((r) => r.rol.nombre),
    })),
  });
});

// PATCH /usuarios/:id/roles [admin]  { roles: string[] }  -> reemplaza el set completo de roles.
router.patch('/:id/roles', requireAuth, requireRole('administrador'), async (req, res) => {
  const { roles } = req.body;
  if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles debe ser un arreglo de strings.' });

  const rolesValidos = ['docente', 'encargado_sala', 'directivo', 'administrador'];
  const invalidos = roles.filter((r) => !rolesValidos.includes(r));
  if (invalidos.length) return res.status(400).json({ error: `Roles inválidos: ${invalidos.join(', ')}` });

  const usuario = await prisma.usuario.findFirst({ where: { id: req.params.id, colegioId: req.user.colegioId } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const rolesDb = await prisma.rol.findMany({ where: { nombre: { in: roles } } });

  await prisma.$transaction([
    prisma.usuarioRol.deleteMany({ where: { usuarioId: usuario.id } }),
    prisma.usuarioRol.createMany({ data: rolesDb.map((r) => ({ usuarioId: usuario.id, rolId: r.id })) }),
  ]);

  const actualizado = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    include: { roles: { include: { rol: true } } },
  });
  res.json({
    usuario: {
      id: actualizado.id,
      nombre: actualizado.nombre,
      email: actualizado.emailInstitucional,
      roles: actualizado.roles.map((r) => r.rol.nombre),
    },
  });
});

module.exports = router;
