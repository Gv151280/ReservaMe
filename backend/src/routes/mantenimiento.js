const express = require('express');
const prisma = require('../db');
const { enviarPush } = require('../lib/push');

const router = express.Router();

// GET /mantenimiento/recordatorio-respaldo
// Lo llama cron-job.org una vez por semana con el header x-cron-secret.
// Envía un push a cada administrador recordando hacer el respaldo manual
// (exportar reservas a CSV y usuarios desde Neon), mientras no haya snapshots automáticos.
router.get('/recordatorio-respaldo', async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.get('x-cron-secret') !== secreto) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const admins = await prisma.usuario.findMany({
      where: { activo: true, roles: { some: { rol: { nombre: 'administrador' } } } },
      select: { id: true, nombre: true },
    });

    const mensaje = 'Recordatorio semanal: exporta las reservas a CSV y los usuarios desde Neon (SQL Editor) para mantener el respaldo al día.';

    let enviados = 0;
    for (const admin of admins) {
      try {
        await enviarPush(admin.id, { title: 'ReservaMe — Respaldo semanal', body: mensaje });
        enviados++;
      } catch (err) {
        console.error(`[mantenimiento] No se pudo avisar a ${admin.nombre}:`, err);
      }
    }

    res.json({ administradores: admins.length, enviados });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
