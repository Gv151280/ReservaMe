import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://reservame-backend.onrender.com';

export default function ConfirmarAcceso() {
  const router = useRouter();
  const [estado, setEstado] = useState('cargando'); // cargando | error

  useEffect(() => {
    if (!router.isReady) return;
    const { token } = router.query;
    if (!token) {
      setEstado('error');
      return;
    }

    fetch(`${API_BASE}/auth/confirmar?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo validar el acceso.');
        }
        router.replace('/');
      })
      .catch((err) => {
        setEstado('error');
        router.replace(`/login?error=${encodeURIComponent(err.message)}`);
      });
  }, [router.isReady, router.query, router]);

  return (
    <div className="centered-page">
      <p className="page-sub">
        {estado === 'cargando' ? 'Confirmando tu acceso…' : 'Hubo un problema, redirigiendo…'}
      </p>
    </div>
  );
}
