export default function Privacidad() {
  const seccion = { marginBottom: 22 };
  const titulo = { fontSize: 16, fontWeight: 700, margin: '0 0 6px' };
  const texto = { fontSize: 14, lineHeight: 1.6, margin: 0 };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 4px 40px' }}>
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 12 }}
      >
        ← Volver
      </button>
      <h1 className="page-title">Política de privacidad</h1>
      <p className="page-sub">Última actualización: 06-10-2026 </p>

      <div style={seccion}>
        <h2 style={titulo}>1. Responsable</h2>
        <p style={texto}>
          Los datos de esta aplicación son tratados por el Instituto Cumbre de Cóndores Poniente.
          Para consultas sobre privacidad escribe a german.vega@sleplosparques.gob.cl.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>2. Datos que recopilamos</h2>
        <p style={texto}>
          Nombre, correo institucional y roles asignados (docente, encargado de sala, directivo o administrador).
          También guardamos las reservas que realizas: sala, fecha, horario, tipo de uso, equipamiento solicitado
          y, cuando corresponda, el motivo de rechazo. Si activas las notificaciones push, guardamos un identificador
          de tu navegador o dispositivo para poder enviarlas.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>3. Para qué los usamos</h2>
        <p style={texto}>
          Para gestionar las reservas de salas, enviarte avisos sobre su estado (confirmación, aprobación,
          rechazo, anulación y recordatorios), y permitir que el colegio organice el uso de sus espacios.
          No usamos tus datos para publicidad ni los vendemos.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>4. Quién puede verlos</h2>
        <p style={texto}>
          Cada docente ve sus propias reservas. Los encargados de sala, directivos y administradores ven las
          reservas necesarias para cumplir su función dentro del colegio. El acceso queda limitado a la
          institución y a los proveedores técnicos que operan la aplicación.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>5. Cuánto tiempo los guardamos</h2>
        <p style={texto}>
          Mientras la cuenta esté activa y el colegio necesite el historial de reservas. Los enlaces de inicio de
          sesión son temporales y caducan al poco tiempo de emitirse.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>6. Tus derechos</h2>
        <p style={texto}>
          Puedes pedir acceso a tus datos, corregirlos o solicitar su eliminación escribiendo a
          german.vega@sleplosparques.gob.cl. Las notificaciones push se pueden desactivar en Ajustes, y el navegador
          también permite revocar el permiso en cualquier momento.
        </p>
      </div>
    </div>
  );
}
