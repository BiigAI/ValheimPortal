import { useState } from 'react';
import { type ModeType } from '../components/ui/SimpleAdvancedToggle';

export function useTabMode(tabKey: string, defaultMode: ModeType = 'simple'): [ModeType, (mode: ModeType) => void] {
  const storageKey = `bifrostheim_mode_${tabKey}`;

  const [mode, setModeState] = useState<ModeType>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'simple' || saved === 'advanced') {
        return saved;
      }
    } catch {
      // ignore localStorage errors in sandboxed iframes
    }
    return defaultMode;
  });

  const setMode = (newMode: ModeType) => {
    setModeState(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {
      // ignore
    }
  };

  return [mode, setMode];
}
