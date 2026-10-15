const prisma = require('../db');
const { enviarPush } = require('./push');
const { sendEmail } = require('../providers/emailProvider');

const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtFecha = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' });

// Avisa (push + email) a quienes esperan un horario que acaba de liberarse.
// No reserva por ellos: cualquiera puede entrar a reservarla, por orden de llegada.
async function avisarListaEspera({ salaId, salaNombre, fechaInicio, fechaFin }) {
  const candidatos = await prisma.listaEspera.findMany({
    where: {
      salaId,
      notificado: false,
      fechaInicio: { lt: fechaFin },
      fechaFin: { gt: fechaInicio },
    },
    orderBy: { creadoEn: 'asc' },
  });

  for (const c of candidatos) {
    const mensaje = `${salaNombre} quedó libre el ${fmtFecha.format(c.fechaInicio)} de ${fmtHora.format(c.fechaInicio)} a ${fmtHora.format(c.fechaFin)}. Entra a reservarla si todavía te sirve.`;

    try {
      await enviarPush(c.usuarioId, { title: 'ReservaMe — Sala disponible', body: mensaje });
    } catch (err) {
      console.error('[listaEspera] Error enviando push:', err);
    }
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id: c.usuarioId } });
      if (usuario) await sendEmail({ to: usuario.emailInstitucional, subject: 'ReservaMe — una sala que esperabas quedó libre', body: mensaje });
    } catch (err) {
      console.error('[listaEspera] Error enviando email:', err);
    }

    await prisma.listaEspera.update({ where: { id: c.id }, data: { notificado: true } });
  }
}

module.exports = { avisarListaEspera };
