import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

export default function AdminColegio() {
  const { showToast } = useToast();
  const [colegio, setColegio] = useState(null);
  const [nombre, setNombre] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [textoNomina, setTextoNomina] = useState('');
  const [resultado, setResultado] = useState(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    api.get('/colegio').then((d) => { setColegio(d.colegio); setNombre(d.colegio.nombre); setLogoUrl(d.colegio.logoUrl || ''); });
  }, []);

  async function guardarColegio() {
    try {
      const d = await api.patch('/colegio', { nombre, logoUrl });
      setColegio(d.colegio);
      showToast('Datos del colegio guardados.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function importarNomina() {
    // Formato esperado, una persona por línea: Nombre completo, correo, función
    const filas = textoNomina
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [nombre, email, funcion] = l.split(',').map((x) => x?.trim());
        return { nombre, email, funcion };
      });
    if (filas.length === 0) { showToast('Pega al menos una fila.', 'error'); return; }

    setImportando(true);
    try {
      const d = await api.post('/usuarios/importar', { filas });
      setResultado(d);
      showToast(`${d.creados} creados, ${d.existentes} ya existían.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImportando(false);
    }
  }

  if (!colegio) return <p className="page-sub">Cargando…</p>;

  return (
    <div>
      <h1 className="page-title">Colegio</h1>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Datos del colegio</h3>
        <div className="field">
          <label>Nombre</label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label>URL de la insignia/logo (imagen ya publicada en internet)</label>
          <input type="text" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={guardarColegio}>Guardar</button>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Importar nómina</h3>
        <p className="hint">
          Solo las personas en esta lista podrán entrar a la app. En Excel, ordena las columnas Nombre / Correo / Función
          y pega el rango directo aquí (una persona por línea, separado por comas). Función debe ser: Docente, Encargado,
          Directivo o Administrador.
        </p>
        <textarea
          rows={8}
          style={{ width: '100%', padding: 10, borderRadius: 11, border: '1.5px solid #e4deec', fontFamily: 'monospace', fontSize: 12.5 }}
          placeholder={'Juan Pérez, juan.perez@colegio.cl, Docente\nMaría López, maria.lopez@colegio.cl, Encargado'}
          value={textoNomina}
          onChange={(e) => setTextoNomina(e.target.value)}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={importando} onClick={importarNomina}>
          {importando ? 'Importando…' : 'Importar'}
        </button>
        {resultado && (
          <div style={{ marginTop: 12 }}>
            <p className="hint">✅ {resultado.creados} creados · ℹ️ {resultado.existentes} ya existían</p>
            {resultado.errores.length > 0 && (
              <ul style={{ color: 'var(--coral-dark)', fontSize: 12.5 }}>
                {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
