// Sección 4 del doc técnico: "el primer Administrador no puede auto-asignarse
// desde la app, se crea manualmente al desplegar el sistema (script de seed)".
// Este script hace exactamente eso, además de dejar el resto de los datos
// base listos: colegio, roles, las 2 salas del MVP, y el horario institucional
// real del colegio (9 horas de clase de 45 min con sus recreos reales).

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLES = ['docente', 'encargado_sala', 'administrador'];

// lunes=1 ... sábado=6, domingo=0 (getDay() de JS)
// Horario real del colegio: 9 horas de clase de 45 min cada una, con 4 recreos
// (20 min, 10 min, 45 min de almuerzo, 15 min). Miércoles termina después de la
// 6ª hora (13:00), sin las últimas 3 horas ni el recreo de almuerzo.
const HORAS_COMPLETAS = [
  { horaInicio: 480, horaFin: 525 }, // 1ª hora  08:00-08:45
  { horaInicio: 525, horaFin: 570 }, // 2ª hora  08:45-09:30
  // recreo 20 min: 09:30-09:50
  { horaInicio: 590, horaFin: 635 }, // 3ª hora  09:50-10:35
  { horaInicio: 635, horaFin: 680 }, // 4ª hora  10:35-11:20
  // recreo 10 min: 11:20-11:30
  { horaInicio: 690, horaFin: 735 }, // 5ª hora  11:30-12:15
  { horaInicio: 735, horaFin: 780 }, // 6ª hora  12:15-13:00
  // recreo almuerzo 45 min: 13:00-13:45
  { horaInicio: 825, horaFin: 870 }, // 7ª hora  13:45-14:30
  { horaInicio: 870, horaFin: 915 }, // 8ª hora  14:30-15:15
  // recreo 15 min: 15:15-15:30
  { horaInicio: 930, horaFin: 975 }, // 9ª hora  15:30-16:15
];
const HORAS_MIERCOLES = HORAS_COMPLETAS.slice(0, 6); // hasta la 6ª hora, termina 13:00

const HORARIO_DEFAULT = [
  { diaSemana: 1, abierto: true, horaInicio: 480, horaSalidaProfesores: 990, bloques: HORAS_COMPLETAS },  // lunes, salida profesores 16:30
  { diaSemana: 2, abierto: true, horaInicio: 480, horaSalidaProfesores: 990, bloques: HORAS_COMPLETAS },  // martes
  { diaSemana: 3, abierto: true, horaInicio: 480, horaSalidaProfesores: 1020, bloques: HORAS_MIERCOLES }, // miércoles, salida profesores 17:00
  { diaSemana: 4, abierto: true, horaInicio: 480, horaSalidaProfesores: 990, bloques: HORAS_COMPLETAS },  // jueves
  { diaSemana: 5, abierto: true, horaInicio: 480, horaSalidaProfesores: 990, bloques: HORAS_COMPLETAS },  // viernes
  { diaSemana: 6, abierto: false, horaInicio: 540, horaSalidaProfesores: 540, bloques: [] },              // sábado cerrado
  { diaSemana: 0, abierto: false, horaInicio: 540, horaSalidaProfesores: 540, bloques: [] },               // domingo cerrado
];

async function main() {
  const nombreColegio = process.env.COLEGIO_NOMBRE || 'Colegio Ejemplo';
  const colegio = await prisma.colegio.upsert({
    where: { id: await colegioIdExistente() },
    update: {},
    create: { nombre: nombreColegio },
  });
  console.log(`Colegio: ${colegio.nombre} (${colegio.id})`);

  for (const nombre of ROLES) {
    await prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('Roles listos:', ROLES.join(', '));

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@colegio.cl').toLowerCase();
  const adminNombre = process.env.ADMIN_NOMBRE || 'Admin Sistema';
  const rolAdmin = await prisma.rol.findUnique({ where: { nombre: 'administrador' } });

  let admin = await prisma.usuario.findUnique({ where: { emailInstitucional: adminEmail } });
  if (!admin) {
    admin = await prisma.usuario.create({
      data: {
        colegioId: colegio.id,
        nombre: adminNombre,
        emailInstitucional: adminEmail,
        roles: { create: [{ rolId: rolAdmin.id }] },
      },
    });
    console.log(`Primer Administrador creado: ${adminEmail}`);
  } else {
    console.log(`Administrador ya existía: ${adminEmail}`);
  }

  const salaProyectos = await upsertSalaPorNombre(colegio.id, {
    nombre: 'Sala de Proyectos',
    capacidad: 15,
    equipamiento: 'Proyector, pizarra, 15 sillas móviles',
    modoReserva: 'autoservicio',
    encargadoId: null,
  });
  const salaCra = await upsertSalaPorNombre(colegio.id, {
    nombre: 'CRA',
    capacidad: 30,
    equipamiento: '20 notebooks, estanterías, mesas de trabajo',
    modoReserva: 'con_aprobacion',
    encargadoId: null, // asigna un encargado desde el panel de Admin después de crear ese usuario
  });
  console.log('Salas listas:', salaProyectos.nombre, '/', salaCra.nombre);

  for (const dia of HORARIO_DEFAULT) {
    const { bloques, ...camposDia } = dia;
    await prisma.horarioInstitucional.upsert({
      where: { colegioId_diaSemana: { colegioId: colegio.id, diaSemana: dia.diaSemana } },
      update: {},
      create: {
        colegioId: colegio.id,
        ...camposDia,
        bloques: { create: bloques },
      },
    });
  }
  console.log('Horario institucional real configurado (editable desde Admin > Horario).');

  async function colegioIdExistente() {
    const existente = await prisma.colegio.findFirst();
    return existente ? existente.id : '00000000-0000-0000-0000-000000000000';
  }
}

async function upsertSalaPorNombre(colegioId, datos) {
  const existente = await prisma.sala.findFirst({ where: { colegioId, nombre: datos.nombre } });
  if (existente) return existente;
  return prisma.sala.create({ data: { colegioId, ...datos } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
