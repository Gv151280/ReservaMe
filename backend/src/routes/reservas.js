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
const { avisarListaEspera } = require('../lib/listaEspera');

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

// Devuelve el bloqueo activo que se cruza con el rango en esa sala, o null.
async function bloqueoEnRango(salaId, inicio, fin) {
  return prisma.bloqueo.findFirst({
    where: { salaId, activo: true, fechaInicio: { lt: fin }, fechaFin: { gt: inicio } },
  });
}

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
    const bloqueo = await bloqueoEnRango(salaId, inicio, fin);
    if (bloqueo) throw errorHttp(409, `La sala está bloqueada en ese horario: ${bloqueo.motivo}.`);

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
    const bloqueo = await bloqueoEnRango(reserva.salaId, reserva.fechaInicio, reserva.fechaFin);
    if (bloqueo) throw errorHttp(409, `La sala está bloqueada en ese horario: ${bloqueo.motivo}.`);

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

    await avisarListaEspera({ salaId: reserva.salaId, salaNombre: reserva.sala.nombre, fechaInicio: reserva.fechaInicio, fechaFin: reserva.fechaFin });

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
    
    await avisarListaEspera({ salaId: reserva.salaId, salaNombre: reserva.sala.nombre, fechaInicio: reserva.fechaInicio, fechaFin: reserva.fechaFin });

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

// GET /reservas/estadisticas?desde=ISO&hasta=ISO [solo administrador]
// Agrega las reservas CONFIRMADAS del colegio: por sala, hora del día, día de la
// semana y tipo de uso. Sirve para ver qué salas y horarios se usan más.
router.get('/estadisticas', requireAuth, requireRole('administrador'), async (req, res) => {
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
        estado: 'confirmada',
        ...(Object.keys(filtroFecha).length ? { fechaInicio: filtroFecha } : {}),
      },
      include: { sala: true },
    });

    const TZ = 'America/Santiago';
    const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', hour12: false });
    const fmtDia = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, weekday: 'long' });

    const porSala = {};
    const porHora = {};
    const porDiaSemana = {};
    const porTipoUso = { clase: 0, reunion_otro: 0 };

    for (const r of reservas) {
      const salaNombre = r.sala?.nombre || 'Sala eliminada';
      porSala[salaNombre] = (porSala[salaNombre] || 0) + 1;

      const hora = fmtHora.format(r.fechaInicio) + ':00';
      porHora[hora] = (porHora[hora] || 0) + 1;

      let dia = fmtDia.format(r.fechaInicio);
      dia = dia.charAt(0).toUpperCase() + dia.slice(1);
      porDiaSemana[dia] = (porDiaSemana[dia] || 0) + 1;

      if (porTipoUso[r.tipoUso] !== undefined) porTipoUso[r.tipoUso]++;
    }

    const aArreglo = (obj) =>
      Object.entries(obj)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    res.json({
      total: reservas.length,
      porSala: aArreglo(porSala),
      porHora: aArreglo(porHora).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      porDiaSemana: ORDEN_DIAS.filter((d) => porDiaSemana[d]).map((d) => ({ nombre: d, cantidad: porDiaSemana[d] })),
      porTipoUso,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /reservas/calendario?desde=ISO&hasta=ISO
// Devuelve, por cada sala activa del colegio, las reservas (pendientes y confirmadas)
// y los bloqueos activos que caen dentro del rango. Pensado para un solo día.
router.get('/calendario', requireAuth, async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let inicioDia, finDia;
    if (desde && hasta) {
      inicioDia = new Date(desde);
      finDia = new Date(hasta);
      if (isNaN(inicioDia) || isNaN(finDia)) throw errorHttp(400, 'Parámetros de fecha inválidos.');
    } else {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
      inicioDia = new Date(`${hoy}T00:00:00`);
      finDia = new Date(`${hoy}T23:59:59`);
    }

    const salas = await prisma.sala.findMany({
      where: { colegioId: req.user.colegioId, activa: true },
      orderBy: { nombre: 'asc' },
    });

    const reservas = await prisma.reserva.findMany({
      where: {
        sala: { colegioId: req.user.colegioId },
        estado: { in: ['pendiente', 'confirmada'] },
        fechaInicio: { lt: finDia },
        fechaFin: { gt: inicioDia },
      },
      include: { usuario: { select: { nombre: true } } },
    });

    const bloqueos = await prisma.bloqueo.findMany({
      where: {
        sala: { colegioId: req.user.colegioId },
        activo: true,
        fechaInicio: { lt: finDia },
        fechaFin: { gt: inicioDia },
      },
    });

    const resultado = salas.map((sala) => {
      const ocupaciones = [
        ...reservas
          .filter((r) => r.salaId === sala.id)
          .map((r) => ({
            tipo: 'reserva',
            estado: r.estado,
            inicio: r.fechaInicio,
            fin: r.fechaFin,
            titulo: `${r.tipoUso === 'clase' ? 'Clase' : 'Reunión'} · ${r.usuario?.nombre || ''}`,
          })),
        ...bloqueos
          .filter((b) => b.salaId === sala.id)
          .map((b) => ({
            tipo: 'bloqueo',
            estado: 'bloqueado',
            inicio: b.fechaInicio,
            fin: b.fechaFin,
            titulo: `Bloqueado: ${b.motivo}`,
          })),
      ].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

      return { id: sala.id, nombre: sala.nombre, ocupaciones };
    });

    res.json({ salas: resultado });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /reservas/lista-espera -> anotarse para que avisen si un horario se libera.
// body: { salaId, fechaInicio, fechaFin }
router.post('/lista-espera', requireAuth, async (req, res) => {
  try {
    const { salaId, fechaInicio, fechaFin } = req.body;
    if (!salaId || !fechaInicio || !fechaFin) {
      throw errorHttp(400, 'Faltan campos: salaId, fechaInicio, fechaFin.');
    }
    const sala = await prisma.sala.findFirst({ where: { id: salaId, colegioId: req.user.colegioId, activa: true } });
    if (!sala) throw errorHttp(404, 'Sala no encontrada o inactiva.');

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    if (isNaN(inicio) || isNaN(fin) || fin <= inicio) throw errorHttp(400, 'Horario inválido.');

    const existente = await prisma.listaEspera.findFirst({
      where: { usuarioId: req.user.id, salaId, fechaInicio: inicio, fechaFin: fin, notificado: false },
    });
    if (existente) throw errorHttp(400, 'Ya estás en la lista de espera para ese horario.');

    const entrada = await prisma.listaEspera.create({
      data: { colegioId: req.user.colegioId, salaId, salaNombre: sala.nombre, usuarioId: req.user.id, fechaInicio: inicio, fechaFin: fin },
    });
    res.status(201).json({ entrada });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /reservas/lista-espera/mia -> mis horarios en espera, sin avisar todavía.
router.get('/lista-espera/mia', requireAuth, async (req, res) => {
  const entradas = await prisma.listaEspera.findMany({
    where: { usuarioId: req.user.id, notificado: false },
    orderBy: { fechaInicio: 'asc' },
  });
  res.json({ entradas });
});

// DELETE /reservas/lista-espera/:id -> salir de la lista de espera (propia).
router.delete('/lista-espera/:id', requireAuth, async (req, res) => {
  const entrada = await prisma.listaEspera.findUnique({ where: { id: req.params.id } });
  if (!entrada) return res.status(404).json({ error: 'No encontrada.' });
  if (entrada.usuarioId !== req.user.id) return res.status(403).json({ error: 'No puedes salir de la lista de espera de otra persona.' });
  await prisma.listaEspera.delete({ where: { id: entrada.id } });
  res.json({ ok: true });
});

// GET /reservas/recordatorios-pendientes/procesar
// Lo llama cron-job.org con el header x-cron-secret (sugerido: cada 6 horas).
// Reenvía el aviso, UNA sola vez, a quien debe aprobar una reunión que lleva
// más de 24 horas pendiente sin respuesta.
router.get('/recordatorios-pendientes/procesar', async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.get('x-cron-secret') !== secreto) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const candidatas = await prisma.reserva.findMany({
      where: {
        estado: 'pendiente',
        recordatorioPendienteEnviado: false,
        creadoEn: { lte: limite },
      },
      include: {
        sala: true,
        usuario: { select: { nombre: true } },
      },
    });

    const fmtFechaHora = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });

    let enviados = 0;
    for (const r of candidatas) {
      const { count } = await prisma.reserva.updateMany({
        where: { id: r.id, recordatorioPendienteEnviado: false },
        data: { recordatorioPendienteEnviado: true },
      });
      if (count === 0) continue;

      let destinatarios = [];
      if (r.sala.encargadoId) {
        destinatarios = [r.sala.encargadoId];
      } else {
        const admins = await prisma.usuario.findMany({
          where: { colegioId: req_colegioId_de(r), roles: { some: { rol: { nombre: 'administrador' } } } },
          select: { id: true },
        });
        destinatarios = admins.map((a) => a.id);
      }

      const mensaje = `Sigue pendiente: ${r.usuario?.nombre || 'un docente'} solicitó ${r.sala.nombre} el ${fmtFechaHora.format(r.fechaInicio)} y aún no tiene respuesta (pedida el ${fmtFechaHora.format(r.creadoEn)}).`;

      for (const destinatarioId of destinatarios) {
        await crearNotificacion({ reservaId: r.id, destinatarioId, canal: 'push', mensaje });
        await crearNotificacion({ reservaId: r.id, destinatarioId, canal: 'email', mensaje });
      }
      enviados++;
    }

    res.json({ candidatas: candidatas.length, enviados });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

// GET /reservas/auditoria?accion=... [solo administrador]
// Devuelve los últimos 200 registros de auditoría del colegio, con filtro opcional por acción.
router.get('/auditoria', requireAuth, requireRole('administrador'), async (req, res) => {
  try {
    const where = { colegioId: req.user.colegioId };
    if (req.query.accion) where.accion = String(req.query.accion);

    const registros = await prisma.auditLog.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      take: 200,
    });
    res.json({ registros });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
