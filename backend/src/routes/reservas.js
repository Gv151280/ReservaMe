const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const {
  errorHttp,
  validarSinSolape,
  validarAnticipacion,
  validarTipoUsoYHorario,
  puedeGestionarSala,
  puedeCancelar,
} = require('../lib/validaciones');
const {
  crearNotificacion,
  notificarReservaPendiente,
  notificarReservaConfirmada,
  notificarReservaAprobada,
  notificarReservaRechazada,
} = require('../lib/notificaciones');
const { registrarAuditoria } = require('../lib/auditoria');

const router = express.Router();

// GET /reservas/mias -> reservas del usuario actual.
router.get('/mias', requireAuth, async (req, res) => {
  const reservas = await prisma.reserva.findMany({
    where: { usuarioId: req.user.id },
    include: { sala: true },
    orderBy: { fechaInicio: 'desc' },
  });
  res.json({ reservas });
});

// GET /reservas/pendientes [encargado de alguna sala, o admin] -> pendientes de sus salas.
router.get('/pendientes', requireAuth, async (req, res) => {
  const esAdmin = req.user.roles.includes('administrador');
  const salas = await prisma.sala.findMany({
    where: esAdmin
      ? { colegioId: req.user.colegioId }
      : { colegioId: req.user.colegioId, encargadoId: req.user.id },
    select: { id: true },
  });
  const salaIds = salas.map((s) => s.id);
  if (salaIds.length === 0) return res.json({ reservas: [] });

  const reservas = await prisma.reserva.findMany({
    where: { salaId: { in: salaIds }, estado: 'pendiente' },
    include: { sala: true, usuario: { select: { id: true, nombre: true, emailInstitucional: true } } },
    orderBy: { fechaInicio: 'asc' },
  });
  res.json({ reservas });
});

// GET /reservas/todas [directivo o admin] -> todas las reservas activas del colegio
// (para poder ubicar y anular la de cualquier docente, en cualquier sala).
router.get('/todas', requireAuth, requireRole('directivo', 'administrador'), async (req, res) => {
  const reservas = await prisma.reserva.findMany({
    where: {
      sala: { colegioId: req.user.colegioId },
      estado: { in: ['pendiente', 'confirmada'] },
    },
    include: { sala: true, usuario: { select: { id: true, nombre: true, emailInstitucional: true } } },
    orderBy: { fechaInicio: 'asc' },
  });
  res.json({ reservas });
});

// Filtra el equipamiento pedido para que solo queden ítems que la sala realmente
// ofrece, y que el número pedido no supere el máximo configurado.
function filtrarEquipamiento(itemsSala, solicitado) {
  if (!Array.isArray(solicitado)) return [];
  const porNombre = new Map((itemsSala || []).map((it) => [it.nombre, it]));
  const resultado = [];
  for (const pedido of solicitado) {
    const item = porNombre.get(pedido?.nombre);
    if (!item) continue; // ítem que la sala no ofrece -> se ignora en silencio
    if (item.tieneCantidad) {
      let cantidad = Number(pedido.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      if (item.cantidadMaxima) cantidad = Math.min(cantidad, item.cantidadMaxima);
      resultado.push({ nombre: item.nombre, cantidad });
    } else {
      resultado.push({ nombre: item.nombre });
    }
  }
  return resultado;
}

// POST /reservas -> crea la reserva validando TODAS las reglas de negocio del backend.
// body: { salaId, tipoUso, fechaInicio, fechaFin, equipamientoSolicitado?: [{nombre, cantidad?}] }
// El estado (confirmada/pendiente) depende SOLO de tipoUso: "clase" siempre es
// automática, "reunion_otro" siempre requiere aprobación — sin importar la sala.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { salaId, tipoUso, fechaInicio, fechaFin, equipamientoSolicitado } = req.body;
    if (!salaId || !tipoUso || !fechaInicio || !fechaFin) {
      throw errorHttp(400, 'Faltan campos: salaId, tipoUso, fechaInicio, fechaFin.');
    }
    if (!['clase', 'reunion_otro'].includes(tipoUso)) {
      throw errorHttp(400, 'tipo_uso inválido: debe ser "clase" o "reunion_otro".');
    }

    const sala = await prisma.sala.findFirst({ where: { id: salaId, colegioId: req.user.colegioId, activa: true } });
    if (!sala) throw errorHttp(404, 'Sala no encontrada o inactiva.');

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    validarAnticipacion(inicio);
    await validarTipoUsoYHorario(req.user.colegioId, tipoUso, inicio, fin);
    await validarSinSolape(salaId, inicio, fin);

    const equipamiento = filtrarEquipamiento(sala.itemsEquipamiento, equipamientoSolicitado);
    const estado = tipoUso === 'clase' ? 'confirmada' : 'pendiente';

    const reserva = await prisma.reserva.create({
      data: {
        salaId,
        usuarioId: req.user.id,
        tipoUso,
        fechaInicio: inicio,
        fechaFin: fin,
        estado,
        equipamientoSolicitado: equipamiento,
      },
    });

    if (estado === 'confirmada') {
      await notificarReservaConfirmada({ reserva, sala, usuarioId: req.user.id });
    } else {
      await notificarReservaPendiente({ reserva, sala, solicitante: req.user });
    }

    res.status(201).json({ reserva });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /reservas/:id/aprobar [encargado de la sala o admin]
router.patch('/:id/aprobar', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeGestionarSala(req.user, reserva.sala)) throw errorHttp(403, 'No tienes permiso para gestionar esta sala.');
    if (reserva.estado !== 'pendiente') throw errorHttp(400, 'Solo se pueden aprobar reservas pendientes.');

    await validarSinSolape(reserva.salaId, reserva.fechaInicio, reserva.fechaFin, reserva.id);

    const actualizada = await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'confirmada' } });
    await notificarReservaAprobada({ reserva: actualizada, sala: reserva.sala });

    await registrarAuditoria({
      colegioId: req.user.colegioId,
      usuario: req.user,
      accion: 'reserva.aprobar',
      entidad: 'reserva',
      entidadId: reserva.id,
      detalle: { sala: reserva.sala.nombre, solicitanteId: reserva.usuarioId, fechaInicio: reserva.fechaInicio },
    });

    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /reservas/:id/rechazar [encargado de la sala o admin]  { motivo?: string }
router.patch('/:id/rechazar', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeGestionarSala(req.user, reserva.sala)) throw errorHttp(403, 'No tienes permiso para gestionar esta sala.');
    if (reserva.estado !== 'pendiente') throw errorHttp(400, 'Solo se pueden rechazar reservas pendientes.');

    const motivo = req.body.motivo || null;
    const actualizada = await prisma.reserva.update({
      where: { id: reserva.id },
      data: { estado: 'rechazada', motivoRechazo: motivo },
    });
    await notificarReservaRechazada({ reserva: actualizada, sala: reserva.sala });

    await registrarAuditoria({
      colegioId: req.user.colegioId,
      usuario: req.user,
      accion: 'reserva.rechazar',
      entidad: 'reserva',
      entidadId: reserva.id,
      detalle: { sala: reserva.sala.nombre, solicitanteId: reserva.usuarioId, fechaInicio: reserva.fechaInicio, motivo },
    });

    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /reservas/:id -> cancelar (propia, o admin).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id }, include: { sala: true } });
    if (!reserva) throw errorHttp(404, 'Reserva no encontrada.');
    if (!puedeCancelar(req.user, reserva)) throw errorHttp(403, 'Solo puedes cancelar tus propias reservas.');
    if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
      throw errorHttp(400, 'Esta reserva ya no se puede cancelar.');
    }

    const actualizada = await prisma.reserva.update({ where: { id: reserva.id }, data: { estado: 'cancelada' } });

    // Si quien cancela no es el dueño de la reserva (un Admin o Directivo la anuló), avisarle y registrarlo.
    if (reserva.usuarioId !== req.user.id) {
      const mensaje = `${req.user.nombre} anuló tu reserva de ${reserva.sala.nombre} del ${new Date(reserva.fechaInicio).toLocaleDateString('es-CL')}.`;
      await crearNotificacion({ reservaId: reserva.id, destinatarioId: reserva.usuarioId, canal: 'push', mensaje });
      await crearNotificacion({ reservaId: reserva.id, destinatarioId: reserva.usuarioId, canal: 'email', mensaje });

      await registrarAuditoria({
        colegioId: req.user.colegioId,
        usuario: req.user,
        accion: 'reserva.anular',
        entidad: 'reserva',
        entidadId: reserva.id,
        detalle: { sala: reserva.sala.nombre, solicitanteId: reserva.usuarioId, fechaInicio: reserva.fechaInicio },
      });
    }

    res.json({ reserva: actualizada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /reservas/exportar-csv?desde=ISO&hasta=ISO [directivo o admin]
// Exporta las reservas del colegio a CSV (separador ";" para que Excel en español lo abra bien).
// desde/hasta son opcionales y filtran por fechaInicio.
router.get('/exportar-csv', requireAuth, requireRole('directivo', 'administrador'), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const filtroFecha = {};
    if (desde) {
      const d = new Date(desde);
      if (isNaN(d)) throw errorHttp(400, 'Parámetro "desde" inválido.');
      filtroFecha.gte = d;
    }
    if (hasta) {
      const h = new Date(hasta);
      if (isNaN(h)) throw errorHttp(400, 'Parámetro "hasta" inválido.');
      filtroFecha.lte = h;
    }

    const reservas = await prisma.reserva.findMany({
      where: {
        sala: { colegioId: req.user.colegioId },
        ...(Object.keys(filtroFecha).length ? { fechaInicio: filtroFecha } : {}),
      },
      include: { sala: true, usuario: { select: { nombre: true, emailInstitucional: true } } },
      orderBy: { fechaInicio: 'asc' },
    });

    const TZ = 'America/Santiago';
    const fmtFecha = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

    const tipoUsoLegible = { clase: 'Clase', reunion_otro: 'Reunión / otro' };
    const estadoLegible = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      rechazada: 'Rechazada',
      cancelada: 'Cancelada',
    };

    // Escapa una celda: envuelve en comillas y duplica las comillas internas.
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const encabezado = [
      'Fecha', 'Hora inicio', 'Hora fin', 'Sala', 'Tipo de uso', 'Estado',
      'Solicitante', 'Correo', 'Equipamiento solicitado', 'Motivo de rechazo',
    ];

    const filas = reservas.map((r) => {
      const equipamiento = Array.isArray(r.equipamientoSolicitado)
        ? r.equipamientoSolicitado
            .map((e) => (e.cantidad ? `${e.nombre} x${e.cantidad}` : e.nombre))
            .join(', ')
        : '';
      return [
        fmtFecha.format(r.fechaInicio),
        fmtHora.format(r.fechaInicio),
        fmtHora.format(r.fechaFin),
        r.sala?.nombre,
        tipoUsoLegible[r.tipoUso] || r.tipoUso,
        estadoLegible[r.estado] || r.estado,
        r.usuario?.nombre,
        r.usuario?.emailInstitucional,
        equipamiento,
        r.motivoRechazo,
      ].map(celda).join(';');
    });

    // BOM UTF-8 para que Excel reconozca tildes y ñ.
    const csv = '\uFEFF' + [encabezado.map(celda).join(';'), ...filas].join('\r\n');

    const hoy = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reservas_${hoy}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /reservas/recordatorios/procesar
// Lo llama cron-job.org cada 5 min con el header x-cron-secret.
// Envía push a los docentes cuyas reservas confirmadas empiezan en los próximos 15 minutos.
router.get('/recordatorios/procesar', async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.get('x-cron-secret') !== secreto) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + 15 * 60 * 1000);

    const candidatas = await prisma.reserva.findMany({
      where: {
        estado: 'confirmada',
        recordatorioEnviado: false,
        fechaInicio: { gt: ahora, lte: limite },
      },
      include: { sala: true },
    });

    const fmtHora = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    let enviados = 0;
    for (const r of candidatas) {
      // Reclamo atómico: si otra ejecución ya la marcó, se salta.
      const { count } = await prisma.reserva.updateMany({
        where: { id: r.id, recordatorioEnviado: false },
        data: { recordatorioEnviado: true },
      });
      if (count === 0) continue;

      const mensaje = `Tu reserva de ${r.sala?.nombre || 'la sala'} comienza a las ${fmtHora.format(r.fechaInicio)}. ¡Te esperamos!`;
      await crearNotificacion({ reservaId: r.id, destinatarioId: r.usuarioId, canal: 'push', mensaje });
      enviados++;
    }

    res.json({ candidatas: candidatas.length, enviados });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
