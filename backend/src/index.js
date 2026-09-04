require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const salasRoutes = require('./routes/salas');
const reservasRoutes = require('./routes/reservas');
const usuariosRoutes = require('./routes/usuarios');
const horarioRoutes = require('./routes/horario');
const notificacionesRoutes = require('./routes/notificaciones');
const bloqueosRoutes = require('./routes/bloqueos');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/salas', salasRoutes);
app.use('/reservas', reservasRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/horario', horarioRoutes);
app.use('/notificaciones', notificacionesRoutes);
app.use('/bloqueos', bloqueosRoutes);

// Manejador de errores genérico (por si algo se escapa de los try/catch de las rutas).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ReservaMe API escuchando en http://localhost:${PORT}`);
  console.log(`Proveedor de autenticación activo: ${process.env.AUTH_PROVIDER || 'magic_link'}`);
});
