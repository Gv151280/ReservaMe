const webpush = require('web-push');
const prisma = require('../db');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:soporte@reservame.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function enviarPush(usuarioId, { title, body, url }) {
  const subs = await prisma.pushSubscription.findMany({ where: { usuarioId } });
  const payload = JSON.stringify({ title, body, url: url || '/' });

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error('[push] Error enviando a', sub.endpoint, err.statusCode || err.message);
      }
    }
  }));
}

module.exports = { enviarPush };
