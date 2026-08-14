const { PrismaClient } = require('@prisma/client');

// Evita crear múltiples instancias del cliente en desarrollo (hot-reload).
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

module.exports = prisma;
