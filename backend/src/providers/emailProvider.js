// Proveedor de correo desacoplado (sección 8 del doc técnico).
// Mientras no esté aprobado el permiso Mail.Send de Microsoft Graph, se usa
// Resend (o similar) como respaldo. Si no hay API key configurada, cae a un
// modo "dev" que solo imprime el correo en consola — así el flujo de
// notificaciones se puede probar de punta a punta sin depender de nada externo.

async function sendEmail({ to, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('\n[emailProvider:dev] ---- Correo simulado ----');
    console.log('Para:', to);
    console.log('Asunto:', subject);
    console.log('Cuerpo:', body);
    console.log('[emailProvider:dev] -------------------------\n');
    return { ok: true, proveedor: 'dev-console' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'ReservaMe <no-responder@colegio.cl>',
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[emailProvider:resend] Error al enviar:', errText);
      return { ok: false, proveedor: 'resend', error: errText };
    }
    return { ok: true, proveedor: 'resend' };
  } catch (err) {
    console.error('[emailProvider:resend] Excepción al enviar:', err.message);
    return { ok: false, proveedor: 'resend', error: err.message };
  }
}

module.exports = { sendEmail };
