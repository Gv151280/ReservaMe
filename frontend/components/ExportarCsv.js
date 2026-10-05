import { useState } from 'react';
import { useToast } from './Toast';

// URL del backend. Si en lib/api.js la URL base está definida de otra forma, usa esa misma.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://reservame-backend.onrender.com';

export default function ExportarCsv({ desde, hasta }) {
  const { showToast } = useToast();
  const [cargando, setCargando] = useState(false);

  async function descargar() {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const qs = params.toString();

      const res = await fetch(`${API_BASE}/reservas/exportar-csv${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo exportar el archivo.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservas_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <button className="btn btn-coral-solid" onClick={descargar} disabled={cargando}>
      {cargando ? 'Exportando…' : 'Exportar CSV'}
    </button>
  );
}
