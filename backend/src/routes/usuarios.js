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

const FUNCION_A_ROL = { docente: 'docente', encargado: 'encargado_sala', directivo: 'directivo', administrador: 'administrador' };

// POST /usuarios/importar [admin]  { filas: [{nombre, email, funcion}] }
// Crea usuarios que aún no existen (por correo), con el rol según "función".
// No toca usuarios que ya existan (para no pisar roles asignados a mano).
router.post('/importar', requireAuth, requireRole('administrador'), async (req, res) => {
  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  const rolesDb = await prisma.rol.findMany();
  const rolIdPorNombre = Object.fromEntries(rolesDb.map((r) => [r.nombre, r.id]));

  let creados = 0, existentes = 0, errores = [];
  for (const fila of filas) {
    const email = (fila.email || '').trim().toLowerCase();
    const nombre = (fila.nombre || '').trim();
    const funcionKey = (fila.funcion || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const rolNombre = FUNCION_A_ROL[funcionKey];
    if (!email || !nombre) { errores.push(`Fila sin nombre o correo: ${JSON.stringify(fila)}`); continue; }
    if (!rolNombre) { errores.push(`Función no reconocida para ${email}: "${fila.funcion}"`); continue; }

    const yaExiste = await prisma.usuario.findUnique({ where: { emailInstitucional: email } });
    if (yaExiste) { existentes++; continue; }

    await prisma.usuario.create({
      data: {
        colegioId: req.user.colegioId,
        nombre,
        emailInstitucional: email,
        roles: { create: [{ rolId: rolIdPorNombre[rolNombre] }] },
      },
    });
    creados++;
  }
  res.json({ creados, existentes, errores });
});

module.exports = router;
