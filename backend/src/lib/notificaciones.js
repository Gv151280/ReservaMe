const prisma = require('../db');
const { sendEmail } = require('../providers/emailProvider');

// Tabla de eventos -> canal, sección 8 del doc técnico.
// El canal "push" queda registrado en la tabla `notificacion` para que el
// frontend lo muestre en la campanita (GET /reservas/mias u otro endpoint de
// notificaciones podría exponerlas); la implementación real de Web Push se
// deja para la Etapa 5 del plan de desarrollo (no bloquea el resto del MVP).
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
      data: {
        estadoEnvio: resultado.ok ? 'enviado' : 'fallido',
        enviadoEn: new Date(),
      },
    });
  } else {
    // Canal "push": por ahora se marca como enviado al quedar registrado;
    // el frontend lo puede leer para mostrarlo en la campanita de notificaciones.
    await prisma.notificacion.update({
      where: { id: notif.id },
      data: { estadoEnvio: 'enviado', enviadoEn: new Date() },
    });
  }

  return notif;
}

// Reserva creada en sala con_aprobacion -> notifica al encargado (push + email).
async function notificarReservaPendiente({ reserva, sala, solicitante }) {
  if (!sala.encargadoId) return;
  const mensaje = `${solicitante.nombre} solicitó reservar ${sala.nombre} — pendiente de tu aprobación.`;
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: sala.encargadoId, canal: 'push', mensaje });
  await crearNotificacion({ reservaId: reserva.id, destinatarioId: sala.encargadoId, canal: 'email', mensaje });
}

// Reserva confirmada (autoservicio) -> notifica a quien reservó (push).
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
