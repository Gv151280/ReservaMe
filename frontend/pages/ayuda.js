export default function Ayuda() {
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

      <h1 className="page-title">Centro de ayuda</h1>
      <p className="page-sub">Preguntas frecuentes sobre ReservaMe.</p>

      <div style={seccion}>
        <h2 style={titulo}>No me llega el correo con el link de acceso</h2>
        <p style={texto}>
          Revisa primero tu carpeta de spam o correo no deseado. El envío puede tardar unos minutos.
          Si pasaron más de 10 minutos y no llegó, solicita un nuevo link desde la pantalla de inicio de sesión
          (el anterior ya no sirve). Si el problema persiste, escribe a [CORREO DE CONTACTO].
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>El link de acceso no funciona o da error</h2>
        <p style={texto}>
          Cada link es válido por 15 minutos y solo se puede usar una vez. Si ya pasó ese tiempo, o si ya
          hiciste clic en él antes, debes pedir uno nuevo. Usa siempre el link más reciente que recibas.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Cómo reservo una sala?</h2>
        <p style={texto}>
          Entra a Inicio, elige la sala, y sigue los pasos: fecha, tipo de uso (clase o reunión), horario
          y equipamiento si lo necesitas. Las clases quedan confirmadas al instante. Las reuniones quedan
          pendientes hasta que el encargado de la sala las apruebe.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Por qué mi reunión no se confirma de inmediato?</h2>
        <p style={texto}>
          Las reservas de tipo "Reunión / otro" siempre requieren aprobación del encargado de esa sala,
          a diferencia de las clases, que se confirman solas. Recibirás una notificación push y un correo
          apenas se apruebe o se rechace.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Cómo cancelo una reserva?</h2>
        <p style={texto}>
          Ve a Mis reservas, pestaña Próximas, y pulsa Cancelar en la reserva correspondiente. Si la reserva
          forma parte de una serie recurrente, también puedes cancelar todas las semanas futuras de esa serie
          con el botón correspondiente.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>Quiero una sala que está ocupada, ¿puedo hacer algo?</h2>
        <p style={texto}>
          Sí. En la pantalla de Disponibilidad, busca el horario ocupado y pulsa "Avisarme si se libera".
          Si esa reserva se cancela o se rechaza, te llegará una notificación para que puedas tomarla.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>El equipamiento de una sala no funciona (proyector, audio, etc.)</h2>
        <p style={texto}>
          Desde la pantalla de reserva de esa sala, pulsa el botón "⚠️ Reportar" y describe el problema.
          El encargado de la sala recibirá un aviso de inmediato.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Qué pasa si bloquean la sala que reservé?</h2>
        <p style={texto}>
          Si un directivo o administrador bloquea una sala en un horario donde ya tenías una reserva, esta
          se anula automáticamente y se te notifica por push y correo, indicando el motivo del bloqueo.
          Puedes reservar otro horario disponible.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>No me llegan las notificaciones push</h2>
        <p style={texto}>
          Revisa que estén activadas en Ajustes (⚙️) dentro de la app. Si ya están activadas pero no llegan,
          revisa los permisos de notificaciones de tu sistema operativo para el navegador que usas (por ejemplo,
          en Windows: Configuración → Sistema → Notificaciones).
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>Mi correo no está autorizado para entrar</h2>
        <p style={texto}>
          Solo pueden acceder los correos institucionales ya cargados por el administrador del colegio.
          Si tu correo no es reconocido, contacta al administrador de ReservaMe en tu colegio para que lo agregue.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Dónde veo la política de privacidad?</h2>
        <p style={texto}>
          Puedes revisarla en cualquier momento desde el menú de Ajustes (⚙️), o directamente en{' '}
          <a href="/privacidad">esta página</a>.
        </p>
      </div>

      <div style={seccion}>
        <h2 style={titulo}>¿Algo más?</h2>
        <p style={texto}>
          Si tu duda no está aquí, escribe a [CORREO DE CONTACTO] o contacta al administrador de ReservaMe
          en tu colegio.
        </p>
      </div>
    </div>
  );
}
