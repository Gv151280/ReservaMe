import { useState } from 'react';
import { useRouter } from 'next/router';
import LogoMark from '../components/LogoMark';
import { api } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [devLink, setDevLink] = useState(null);
  const errorQuery = router.query.error;

  async function enviarLink(e) {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);
    setDevLink(null);
    try {
      const data = await api.post('/auth/magic-link', { email });
      setMensaje(data.mensaje);
      if (data.devLink) setDevLink(data.devLink);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centered-page">
      <div className="logo-wrap">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LogoMark size={56} />
        </div>
      </div>
      <h1 className="page-title">ReservaMe</h1>
      <p className="page-sub">Ingresa con tu correo institucional para reservar salas.</p>

      {errorQuery && (
        <p className="hint" style={{ color: 'var(--coral-dark)', marginBottom: 12 }}>
          {errorQuery}
        </p>
      )}

      <form onSubmit={enviarLink} style={{ textAlign: 'left' }}>
        <div className="field">
          <label>Correo institucional</label>
          <input
            type="email"
            required
            placeholder="tu.nombre@colegio.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviarme el link de acceso'}
        </button>
      </form>

      {mensaje && (
        <p className="hint" style={{ marginTop: 14 }}>
          {mensaje}
        </p>
      )}
      {devLink && (
        <p className="hint" style={{ marginTop: 6 }}>
          Modo desarrollo — como no hay proveedor de correo configurado, entra directo con este link:
          <br />
          <a href={devLink} style={{ color: 'var(--purple-dark)', fontWeight: 700, wordBreak: 'break-all' }}>
            {devLink}
          </a>
        </p>
      )}

      <p className="hint" style={{ marginTop: 22 }}>
        Login provisional (Plan B del doc técnico). Cuando el sostenedor apruebe el acceso a Microsoft Entra ID,
        este formulario se reemplaza por &quot;Iniciar sesión con Microsoft&quot; sin perder tus reservas.
      </p>
    </div>
  );
}
