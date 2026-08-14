// Uso: router.post('/salas', requireAuth, requireRole('administrador'), handler)
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
    const tieneAlguno = req.user.roles.some((r) => rolesPermitidos.includes(r));
    if (!tieneAlguno) {
      return res.status(403).json({ error: `Requiere alguno de estos roles: ${rolesPermitidos.join(', ')}.` });
    }
    next();
  };
}

module.exports = requireRole;
