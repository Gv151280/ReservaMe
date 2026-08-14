const express = require('express');
const prisma = require('../db');
const { firmarSesion, setCookieSesion, limpiarCookieSesion, attachUserIfPresent } = require('../middleware/auth');

const magicLinkProvider = require('../providers/magicLinkProvider');
const entraIdProvider = require('../providers/entraIdProvider');

const router = express.Router();

function proveedorActivo() {
  return process.env.AUTH_PROVIDER === 'entra_id' ? entraIdProvider : magicLinkProvider;
}

// POST /auth/magic-link  { email }  -> envía (o simula) el correo con el link de acceso.
router.post('/magic-link', async (req, res) => {
  try {
    const resultado = await proveedorActivo().initiate({ email: req.body.email });
    res.json({ ok: true, mensaje: 'Revisa tu correo institucional para continuar.', devLink: resultado.devLink });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /auth/callback?token=...  (magic link) o ?code=...  (Entra ID, cuando esté conectado)
// Busca al usuario por email_institucional (o lo crea con rol docente por defecto,
// tal como especifica el doc técnico, sección 7 — "Si no existe -> lo crea
// automáticamente con rol docente por defecto"), abre sesión y redirige al frontend.
router.get('/callback', async (req, res) => {
  try {
    const { email, entraIdOid } = await proveedorActivo().verify(req.query);

    let usuario = await prisma.usuario.findUnique({
      where: { emailInstitucional: email },
      include: { roles: { include: { rol: true } } },
    });

    if (!usuario) {
      const colegio = await prisma.colegio.findFirst();
      if (!colegio) throw Object.assign(new Error('No hay colegio configurado. Ejecuta el seed primero.'), { status: 500 });

      const rolDocente = await prisma.rol.findUnique({ where: { nombre: 'docente' } });
      usuario = await prisma.usuario.create({
        data: {
          colegioId: colegio.id,
          nombre: email.split('@')[0],
          emailInstitucional: email,
          entraIdOid: entraIdOid || null,
          roles: { create: [{ rolId: rolDocente.id }] },
        },
        include: { roles: { include: { rol: true } } },
      });
    } else if (entraIdOid && !usuario.entraIdOid) {
      // Migración Plan B -> Plan A: vincula el oid la primera vez que llega por Entra ID.
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { entraIdOid },
        include: { roles: { include: { rol: true } } },
      });
    }

    const token = firmarSesion(usuario.id);
    setCookieSesion(res, token);
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  } catch (err) {
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontend}/login?error=${encodeURIComponent(err.message)}`);
  }
});

// GET /auth/me -> hidrata la sesión en el frontend al cargar la app.
router.get('/me', attachUserIfPresent, (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  limpiarCookieSesion(res);
  res.json({ ok: true });
});

module.exports = router;
