# ReservaMe — Fase -1 (MVP de Reserva de Salas)

Proyecto de código correspondiente al PRD (`PRD-Fase1-ReservaSalas.md`) y al documento técnico
(`Documento-Tecnico-ReservaMe-Fase1.md`). Sigue la arquitectura ahí definida:

- **Backend:** Node.js + Express + PostgreSQL (Prisma).
- **Frontend:** Next.js (PWA-ready).
- **Autenticación:** Plan B (magic link) activo ahora, con Plan A (Microsoft Entra ID) dejado
  como conector desacoplado, listo para enchufar cuando el sostenedor apruebe el registro de la app.

Este repo cubre el flujo completo descrito en el PRD: las 8 pantallas del MVP, los 3 roles
(Docente / Encargado de sala / Administrador), las reglas de duración de reservas (Clase vs.
Reunión/otro), la validación de solapamiento en servidor, el límite de anticipación de 1 mes,
y el horario institucional configurable por día (salida de estudiantes vs. salida de
encargados/profesores).

## Estructura

```
reservame-app/
  backend/     API REST (Express + Prisma)
  frontend/    Aplicación Next.js
```

## 1. Requisitos

- Node.js 18 o superior
- Una base de datos PostgreSQL (local, o gratis en [Supabase](https://supabase.com),
  [Railway](https://railway.app) o [Render](https://render.com))

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env`:
- `DATABASE_URL`: la conexión a tu Postgres.
- `ADMIN_EMAIL` / `ADMIN_NOMBRE`: quién será el primer Administrador (se crea con el seed,
  tal como especifica el doc técnico — nadie puede auto-asignarse ese rol desde la app).
- El resto de las variables tienen valores por defecto razonables para desarrollo local.

Crea las tablas y carga los datos base (colegio, roles, primer admin, las 2 salas, horario):

```bash
npx prisma migrate dev --name init
npm run seed
```

Levanta la API:

```bash
npm run dev
```

Debería quedar escuchando en `http://localhost:4000`.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Abre `http://localhost:3000`. Como `AUTH_PROVIDER=magic_link` por defecto, al pedir el link
de acceso en `/login` el backend no envía un correo real (a menos que configures
`RESEND_API_KEY`) — en su lugar, la respuesta trae un `devLink` que la pantalla de login
muestra directamente para que puedas entrar sin depender de un proveedor de correo.

Para entrar como Administrador, usa el correo que pusiste en `ADMIN_EMAIL`. Cualquier otro
correo institucional que uses crea automáticamente un usuario nuevo con rol Docente (tal como
especifica el doc técnico), y desde **Admin → Usuarios** le puedes agregar el rol de Encargado
de sala o Administrador.

## 4. Qué falta para producción (próximas etapas del plan de desarrollo)

Este repo cubre el setup del proyecto, el login provisional y el flujo funcional completo
(Etapa 1 en adelante del doc técnico). Lo que queda pendiente no bloquea el uso del MVP:

- **Conectar Microsoft Entra ID (Plan A):** el archivo `backend/src/providers/entraIdProvider.js`
  tiene la interfaz lista y comentarios paso a paso; solo falta que el sostenedor apruebe el
  registro de la app y completar `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET`.
- **Correo institucional real:** mientras no esté aprobado Microsoft Graph, configura
  `RESEND_API_KEY` (o similar) para que las notificaciones por correo salgan de verdad; sin eso,
  quedan solo como `console.log` en el servidor.
- **Notificaciones push reales:** hoy el canal "push" solo se registra en la tabla
  `notificacion` y se muestra en la campanita del frontend; falta integrar Web Push si se quiere
  que lleguen aunque la PWA esté cerrada.
- **Despliegue:** subir el backend (Railway/Render) y el frontend (Vercel), apuntando
  `NEXT_PUBLIC_API_URL` y `FRONTEND_URL`/`AUTH` a las URLs finales, y usar Postgres gestionado.
- **Caso borde de "encargado no responde":** el PRD pide notificar al Administrador tras 24h
  sin respuesta — no está implementado todavía (requiere un job programado / cron).

## 5. Reglas de negocio ya validadas en el backend

- No se puede reservar una sala/horario ya ocupado (se revalida en el momento de crear *y* de
  aprobar, no solo al mostrar el calendario).
- Anticipación máxima de 1 mes, y no se puede reservar en el pasado.
- "Clase": debe ser un bloque de 45 o 90 min alineado al horario institucional del día.
- "Reunión/otro": horario libre, pero dentro del rango entre el inicio de jornada y la salida
  de encargados/profesores de ese día.
- Solo el encargado de la sala (o un Administrador) puede aprobar/rechazar sus solicitudes.
- Solo el dueño de una reserva (o un Administrador) puede cancelarla.
