const prisma = require('../db');

// Registra que una tarea programada (cron) acaba de correr, con su resultado.
// Se usa "upsert" porque la primera vez no existe la fila todavía.
async function registrarEjecucion(clave, resultado) {
  try {
    await prisma.estadoTarea.upsert({
      where: { clave },
      create: { clave, ultimaEjecucion: new Date(), ultimoResultado: resultado },
      update: { ultimaEjecucion: new Date(), ultimoResultado: resultado },
    });
  } catch (err) {
    console.error(`[estadoTarea] No se pudo registrar "${clave}":`, err);
  }
}

module.exports = { registrarEjecucion };
