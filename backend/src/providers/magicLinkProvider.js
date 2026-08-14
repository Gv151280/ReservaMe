// Plan B (provisional) — sección 7 del doc técnico.
// Login sin contraseña por magic link enviado al correo institucional.
// Implementa la misma interfaz que entraIdProvider.js: { name, initiate, verify }
// para que auth.js pueda intercambiar de proveedor sin tocar el resto de la app.

const crypto = require('crypto');
const prisma = require('../db');
const { sendEmail } = require('./emailProvider');

const TOKEN_TTL_MINUTES = 15;

// Paso 1: el usuario ingresa su correo -> se genera un token de un solo uso
// y se le envía un link para volver a la app y autenticarse.
async function initiate({ email }) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado || !emailNormalizado.includes('@')) {
    throw Object.assign(new Error('Correo inválido.'), { status: 400 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.magicLinkToken.create({
    data: { email: emailNormalizado, token, expiresAt },
  });

  const link = backendCallbackUrl(token);

  await sendEmail({
    to: emailNormalizado,
    subject: 'Tu acceso a ReservaMe',
    body: `Hola,\n\nUsa este link para entrar a ReservaMe (válido por ${TOKEN_TTL_MINUTES} minutos):\n${link}\n\nSi no lo solicitaste, ignora este correo.`,
  });

  // En desarrollo devolvemos el link directamente en la respuesta para no
  // depender de un proveedor de correo real mientras se prueba localmente.
  const devLink = process.env.NODE_ENV === 'production' ? undefined : link;
  return { sent: true, devLink };
}

function backendCallbackUrl(token) {
  const port = process.env.PORT || 4000;
  const base = process.env.BACKEND_PUBLIC_URL || `http://localhost:${port}`;
  return `${base}/auth/callback?token=${token}`;
}

// Paso 2: el usuario vuelve con el token -> se valida, se marca usado, y se
// entrega el correo verificado para que auth.js busque/cree el Usuario.
async function verify({ token }) {
  if (!token) throw Object.assign(new Error('Falta el token.'), { status: 400 });

  const registro = await prisma.magicLinkToken.findUnique({ where: { token } });
  if (!registro) throw Object.assign(new Error('Link inválido.'), { status: 401 });
  if (registro.usedAt) throw Object.assign(new Error('Este link ya fue usado.'), { status: 401 });
  if (registro.expiresAt < new Date()) throw Object.assign(new Error('Este link expiró, solicita uno nuevo.'), { status: 401 });

  await prisma.magicLinkToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  return { email: registro.email, entraIdOid: null };
}

module.exports = { name: 'magic_link', initiate, verify };
