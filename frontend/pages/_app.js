import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { SessionProvider, useSession } from '../lib/useSession';
import { ToastProvider } from '../components/Toast';
import Topbar from '../components/Topbar';
import BottomNav from '../components/BottomNav';

const RUTAS_PUBLICAS = ['/login'];

function Guard({ children }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const esPublica = RUTAS_PUBLICAS.includes(router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !esPublica) router.replace('/login');
    if (user && esPublica) router.replace('/');
  }, [loading, user, esPublica, router]);

  if (loading) {
    return (
      <div className="centered-page">
        <p className="page-sub">Cargando…</p>
      </div>
    );
  }

  if (!user && !esPublica) return null; // evita destello de contenido mientras redirige
  if (user && esPublica) return null;

  return children;
}

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Guard>
          <div className="app-shell">
            <Topbar />
            <main className="page">
              <Component {...pageProps} />
            </main>
            <BottomNav />
          </div>
        </Guard>
      </ToastProvider>
    </SessionProvider>
  );
}
