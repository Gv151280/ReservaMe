const prisma = require('../db');

// Registra una acción en el audit log. Si falla, solo registra el error en logs
// y no interrumpe la acción principal (aprobar, anular, etc.).
async function registrarAuditoria({ colegioId, usuario, accion, entidad, entidadId, detalle = {} }) {
  try {
    await prisma.auditLog.create({
      data: {
        colegioId,
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombre,
        accion,
        entidad,
        entidadId: String(entidadId),
        detalle,
      },
    });
  } catch (err) {
    console.error('[auditoria] No se pudo registrar:', err);
  }
}

module.exports = { registrarAuditoria };
