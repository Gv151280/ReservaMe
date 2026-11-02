import { useState } from 'react';
import { useToast } from './Toast';

// URL del backend. Si en lib/api.js la URL base está definida de otra forma, usa esa misma.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://reservame-backend.onrender.com';

export default function ExportarCsv({ desde, hasta, rutaExtra = '/reservas/exportar-csv', params = {} }) {
  const { showToast } = useToast();
  const [cargando, setCargando] = useState(false);

  async function descargar() {
    setCargando(true);
    try {
      const parametros = new URLSearchParams();
      if (desde) parametros.set('desde', desde);
      if (hasta) parametros.set('hasta', hasta);
      Object.entries(params).forEach(([k, v]) => {
        if (v) parametros.set(k, v);
      });
      const qs = parametros.toString();

      const res = await fetch(`${API_BASE}${rutaExtra}${qs ? `?${qs}` : ''}`, {
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
      a.download = `exportado_${new Date().toISOString().slice(0, 10)}.csv`;
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
