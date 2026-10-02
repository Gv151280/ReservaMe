import { useState } from 'react';
import { useSettings } from '../lib/useSettings';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, scaleIndex, setScaleIndex, scaleLabel } = useSettings();

  return (
    <div style={{ position: 'relative' }}>
      <button className="bell-btn" onClick={() => setOpen((o) => !o)} aria-label="Ajustes">⚙️</button>
      {open && (
        <div className="notif-panel settings-panel">
          <h4>Ajustes</h4>
          <div className="settings-row">
            <span>Modo oscuro</span>
            <div className={`switch ${theme === 'dark' ? 'on' : ''}`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
          <div className="scale-row">
            <div className="scale-label">Tamaño de letra: <b>{scaleLabel}</b></div>
            <div className="scale-buttons">
              <button className={scaleIndex === 0 ? 'active' : ''} onClick={() => setScaleIndex(0)}>A-</button>
              <button className={scaleIndex === 1 ? 'active' : ''} onClick={() => setScaleIndex(1)}>A</button>
              <button className={scaleIndex === 2 ? 'active' : ''} onClick={() => setScaleIndex(2)}>A+</button>
              <button className={scaleIndex === 3 ? 'active' : ''} onClick={() => setScaleIndex(3)}>A++</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
