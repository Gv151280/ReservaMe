import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { SessionProvider, useSession } from '../lib/useSession';
import { SettingsProvider } from '../lib/useSettings';
import { ToastProvider } from '../components/Toast';
import Topbar from '../components/Topbar';
import BottomNav from '../components/BottomNav';

// Rutas accesibles con o sin sesión (sin barra superior ni menú inferior).
const RUTAS_LIBRES = ['/privacidad'];
// Rutas que solo se ven sin sesión (si hay sesión, se redirige a /).
const RUTAS_SOLO_SIN_SESION = ['/login'];

function Guard({ children }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const esSoloSinSesion = RUTAS_SOLO_SIN_SESION.includes(router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !esSoloSinSesion) router.replace('/login');
    if (user && esSoloSinSesion) router.replace('/');
  }, [loading, user, esSoloSinSesion, router]);

  if (loading) {
    return (
      <div className="centered-page">
        <p className="page-sub">Cargando…</p>
      </div>
    );
  }

  if (!user && !esSoloSinSesion) return null;
  if (user && esSoloSinSesion) return null;

  return children;
}

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const esLibre = RUTAS_LIBRES.includes(router.pathname);

  return (
    <SettingsProvider>
      <SessionProvider>
        <ToastProvider>
          {esLibre ? (
            <main className="page">
              <Component {...pageProps} />
            </main>
          ) : (
            <Guard>
              <div className="app-shell">
                <Topbar />
                <main className="page">
                  <Component {...pageProps} />
                </main>
                <BottomNav />
              </div>
            </Guard>
          )}
        </ToastProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}
