const prisma = require('../db');
const { sendEmail } = require('../providers/emailProvider');

async function crearNotificacion({ reservaId, destinatarioId, canal, mensaje }) {
  const notif = await prisma.notificacion.create({
    data: { reservaId, destinatarioId, canal, mensaje, estadoEnvio: 'pendiente' },
  });

  if (canal === 'email') {
    const destinatario = await prisma.usuario.findUnique({ where: { id: destinatarioId } });
    const resultado = await sendEmail({
      to: destinatario.emailInstitucional,
      subject: 'ReservaMe — actualización de tu reserva',
      body: mensaje,
    });
    await prisma.notificacion.update({
      where: { id: notif.id },
      data: { estadoEnvio: resultado.ok ? 'enviado' : 'fallido', enviadoEn: new Date() },
    });
  } else {
    await prisma.notificacion.update({
      where: { id: notif.id },
      data: { estadoEnvio: 'enviado', enviadoEn: new Date() },
    });
  }

  return notif;
}

// Destinatarios de una reserva pendiente: el encargado de la sala si tiene uno
// asignado; si no, TODOS los administradores del colegio (para que ninguna
// solicitud quede sin nadie que la vea).
async function destinatariosDeAprobacion(sala) {
  if (sala.encargadoId) return [sala.encargadoId];
  const admins = await prisma.usuario.findMany({
    where: { colegioId: sala.colegioId, roles: { some: { rol: { nombre: 'administrador' } } } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

// Reserva creada con tipo_uso "reunion_otro" (siempre requiere aprobación) ->
// notifica al encargado de la sala, o a los administradores si no hay encargado.
async function notificarReservaPendiente({ reserva, sala, solicitante }) {
  const destinatarios = await destinatariosDeAprobacion(sala);
  const mensaje = `${solicitante.nombre} solicitó reservar ${sala.nombre} — pendiente de tu aprobación.`;
  for (const destinatarioId of destinatarios) {
    await crearNotificacion({ reservaId: reserva.id, destinatarioId, canal: 'push', mensaje });
    await crearNotificacion({ reservaId: reserva.id, destinatarioId, canal: 'email', mensaje });
  }
}

// Reserva de tipo "clase" -> siempre automática -> notifica a quien reservó (push).
async function notificarReservaConfirmada({ reserva, sala, usuarioId }) {
  const mensaje = `Tu reserva de ${sala.nombre} quedó confirmada.`;
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: usuarioId, canal: 'push', mensaje });
}

// Reserva aprobada -> notifica a quien reservó (push).
async function notificarReservaAprobada({ reserva, sala }) {
  const mensaje = `Tu reserva de ${sala.nombre} fue aprobada. ✅`;
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: reserva.usuarioId, canal: 'push', mensaje });
}

// Reserva rechazada -> notifica a quien reservó (push + email, incluye motivo si existe).
async function notificarReservaRechazada({ reserva, sala }) {
  const motivoTxt = reserva.motivoRechazo ? ` Motivo: ${reserva.motivoRechazo}` : '';
  const mensaje = `Tu solicitud de ${sala.nombre} fue rechazada.${motivoTxt}`;
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: reserva.usuarioId, canal: 'push', mensaje });
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: reserva.usuarioId, canal: 'email', mensaje });
}

module.exports = {
  crearNotificacion,
  notificarReservaPendiente,
  notificarReservaConfirmada,
  notificarReservaAprobada,
  notificarReservaRechazada,
};
