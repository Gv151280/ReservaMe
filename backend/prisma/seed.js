// Sección 4 del doc técnico: "el primer Administrador no puede auto-asignarse
// desde la app, se crea manualmente al desplegar el sistema (script de seed)".
// Este script hace exactamente eso, además de dejar el resto de los datos
// base listos: colegio, roles, las 2 salas del MVP, y el horario institucional
// por defecto (mismo que se usó en el prototipo interactivo).

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLES = ['docente', 'encargado_sala', 'administrador'];

// lunes=1 ... sábado=6, domingo=0 (getDay() de JS)
const HORARIO_DEFAULT = [
  { diaSemana: 1, abierto: true, horaInicio: 480, horaSalidaEstudiantes: 960, horaSalidaProfesores: 1080 }, // lunes 08:00-16:00 / hasta 18:00
  { diaSemana: 2, abierto: true, horaInicio: 480, horaSalidaEstudiantes: 960, horaSalidaProfesores: 1080 }, // martes
  { diaSemana: 3, abierto: true, horaInicio: 480, horaSalidaEstudiantes: 960, horaSalidaProfesores: 1080 }, // miércoles
  { diaSemana: 4, abierto: true, horaInicio: 480, horaSalidaEstudiantes: 960, horaSalidaProfesores: 1080 }, // jueves
  { diaSemana: 5, abierto: true, horaInicio: 480, horaSalidaEstudiantes: 780, horaSalidaProfesores: 900 },  // viernes 08:00-13:00 / hasta 15:00
  { diaSemana: 6, abierto: false, horaInicio: 540, horaSalidaEstudiantes: 540, horaSalidaProfesores: 540 }, // sábado cerrado
  { diaSemana: 0, abierto: false, horaInicio: 540, horaSalidaEstudiantes: 540, horaSalidaProfesores: 540 }, // domingo cerrado
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
    await prisma.horarioInstitucional.upsert({
      where: { colegioId_diaSemana: { colegioId: colegio.id, diaSemana: dia.diaSemana } },
      update: {},
      create: { colegioId: colegio.id, ...dia },
    });
  }
  console.log('Horario institucional por defecto configurado (editable desde Admin > Horario).');

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
