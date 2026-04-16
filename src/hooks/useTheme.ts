import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'pear-theme';

function getStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* SSR or disabled storage */ }
  return 'system';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStored);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const cycle = () => {
    setThemeState((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  };

  return { theme, setTheme: setThemeState, cycle } as const;
}
