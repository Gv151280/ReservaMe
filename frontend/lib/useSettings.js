import { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext(null);

const SCALES = [0.9, 1, 1.15, 1.3];
const SCALE_LABELS = ['Pequeño', 'Normal', 'Grande', 'Muy grande'];

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [scaleIndex, setScaleIndexState] = useState(1);

  useEffect(() => {
    const storedTheme = localStorage.getItem('reservame_theme');
    const storedScale = localStorage.getItem('reservame_scale');
    if (storedTheme === 'dark' || storedTheme === 'light') setThemeState(storedTheme);
    if (storedScale !== null && SCALES[Number(storedScale)] !== undefined) setScaleIndexState(Number(storedScale));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--ui-scale', String(SCALES[scaleIndex]));
  }, [theme, scaleIndex]);

  function setTheme(next) {
    setThemeState(next);
    localStorage.setItem('reservame_theme', next);
  }
  function setScaleIndex(next) {
    setScaleIndexState(next);
    localStorage.setItem('reservame_scale', String(next));
  }

  return (
    <SettingsContext.Provider value={{ theme, setTheme, scaleIndex, setScaleIndex, scaleLabel: SCALE_LABELS[scaleIndex] }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
