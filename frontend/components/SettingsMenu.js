import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSettings } from '../lib/useSettings';
import { useToast } from './Toast';
import { pushSoportado, suscripcionActual, activarPush, desactivarPush } from '../lib/push';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, scaleIndex, setScaleIndex, scaleLabel } = useSettings();
  const { showToast } = useToast();
  const [pushOn, setPushOn] = useState(false);
  const [pushDisponible, setPushDisponible] = useState(false);
  const [cargandoPush, setCargandoPush] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    pushSoportado().then(setPushDisponible);
    suscripcionActual().then((s) => setPushOn(!!s));
  }, []);

  // Cierra el panel de Ajustes al hacer clic o tocar fuera de él.
  useEffect(() => {
    if (!open) return;
    function cerrarSiFuera(e) {
      if (containerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', cerrarSiFuera);
    document.addEventListener('touchstart', cerrarSiFuera);
    return () => {
      document.removeEventListener('mousedown', cerrarSiFuera);
      document.removeEventListener('touchstart', cerrarSiFuera);
    };
  }, [open]);

  async function togglePush() {
    setCargandoPush(true);
    try {
      if (pushOn) {
        await desactivarPush();
        setPushOn(false);
      } else {
        await activarPush();
        setPushOn(true);
        showToast('Notificaciones activadas.', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCargandoPush(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)} aria-label="Ajustes">⚙️</button>
      {open && (
        <div className="notif-panel settings-panel">
          <h4>Ajustes</h4>
          <div className="settings-row">
            <span>Modo oscuro</span>
            <div className={`switch ${theme === 'dark' ? 'on' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
          {pushDisponible && (
            <div className="settings-row">
              <span>Notificaciones push</span>
              <div className={`switch ${pushOn ? 'on' : ''}`} onClick={() => !cargandoPush && togglePush()} />
            </div>
          )}
          <div className="scale-row">
            <div className="scale-label">Tamaño de letra: <b>{scaleLabel}</b></div>
            <div className="scale-buttons">
              <button className={scaleIndex === 0 ? 'active' : ''} onClick={() => setScaleIndex(0)}>A-</button>
              <button className={scaleIndex === 1 ? 'active' : ''} onClick={() => setScaleIndex(1)}>A</button>
              <button className={scaleIndex === 2 ? 'active' : ''} onClick={() => setScaleIndex(2)}>A+</button>
              <button className={scaleIndex === 3 ? 'active' : ''} onClick={() => setScaleIndex(3)}>A++</button>
            </div>
          </div>
          <div className="settings-row">
            <Link href="/privacidad" onClick={() => setOpen(false)} style={{ color: 'var(--purple-dark)', textDecoration: 'none' }}>
              Política de privacidad
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
