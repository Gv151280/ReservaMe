// Plan A (definitivo) — sección 7 del doc técnico.
// Login institucional vía Microsoft Entra ID (OAuth2/OIDC con MSAL).
// Implementa la misma interfaz que magicLinkProvider.js: { name, initiate, verify }.
//
// TODO cuando el sostenedor apruebe el registro de la app en el tenant:
//   1. npm install @azure/msal-node
//   2. En initiate(): construir la URL de autorización de Microsoft
//      (authCodeUrlParameters) y devolverla para que el frontend redirija ahí
//      en vez de mostrar el formulario de "ingresa tu correo".
//   3. En verify({ code }): intercambiar el "code" por un token con
//      acquireTokenByCode(), y extraer del id_token el email y el oid
//      (el `entra_id_oid` es el identificador estable — no uses el email
//      para vincular la sesión, el doc técnico es explícito en esto).
//   4. Cambiar AUTH_PROVIDER=entra_id en el .env — auth.js no necesita cambios,
//      ya está escrito contra esta misma interfaz.
//
// La migración de usuarios ya creados vía Plan B es automática: auth.js busca
// primero por email_institucional antes de crear un usuario nuevo, así que el
// primer login con Entra ID vincula la cuenta existente en vez de duplicarla.

async function initiate(_params) {
  throw Object.assign(
    new Error(
      'Login con Microsoft Entra ID aún no está conectado (pendiente de aprobación del sostenedor). Usa AUTH_PROVIDER=magic_link mientras tanto.'
    ),
    { status: 501 }
  );
}

async function verify(_params) {
  throw Object.assign(new Error('entraIdProvider.verify() no implementado todavía.'), { status: 501 });
}

module.exports = { name: 'entra_id', initiate, verify };
