// Debe cargarse ANTES que cualquier otro módulo (incluido Express), por eso vive
// en un archivo separado y se importa como primera línea de index.js.
require('dotenv').config();
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0, // plan gratis: solo errores, sin monitoreo de performance
    environment: process.env.NODE_ENV || 'production',
  });
}

module.exports = Sentry;
