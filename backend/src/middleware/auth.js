const jwt = require('jsonwebtoken');
const prisma = require('../db');

const COOKIE_NAME = 'reservame_session';

function firmarSesion(usuarioId) {
  return jwt.sign({ sub: usuarioId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
}

function setCookieSesion(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12, // 12h, ver nota del doc técnico sobre duración de sesión
    path: '/',
  });
}

function limpiarCookieSesion(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Middleware obligatorio: si no hay sesión válida, corta con 401.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'No autenticado.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { rol: true } } },
    });
    if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Usuario inválido o inactivo.' });

    req.user = {
      id: usuario.id,
      colegioId: usuario.colegioId,
      nombre: usuario.nombre,
      email: usuario.emailInstitucional,
      roles: usuario.roles.map((r) => r.rol.nombre),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// Middleware opcional: si hay sesión la carga, si no, sigue igual (para /auth/me).
async function attachUserIfPresent(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { rol: true } } },
    });
    if (usuario && usuario.activo) {
      req.user = {
        id: usuario.id,
        colegioId: usuario.colegioId,
        nombre: usuario.nombre,
        email: usuario.emailInstitucional,
        roles: usuario.roles.map((r) => r.rol.nombre),
      };
    }
  } catch (_err) {
    // token inválido/expirado -> se trata como no autenticado, sin romper la request
  }
  next();
}

module.exports = { COOKIE_NAME, firmarSesion, setCookieSesion, limpiarCookieSesion, requireAuth, attachUserIfPresent };
