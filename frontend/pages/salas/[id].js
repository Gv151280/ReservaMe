import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Esta pantalla intermedia ya no se usa — el clic en una sala ahora va directo
// al asistente de reserva (pages/reservar.js). Se deja como redirección simple
// por si queda algún enlace o marcador guardado apuntando a /salas/[id].
export default function DetalleSalaRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) router.replace(`/reservar?salaId=${id}`);
  }, [id, router]);

  return <p className="page-sub">Redirigiendo…</p>;
}
