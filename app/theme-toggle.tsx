'use client';

import { useSyncExternalStore } from 'react';

const storageKey = 'fernando-theme';

function subscribe(onChange: () => void) {
  const sync = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* Storage is optional. */ }
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) sync();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('theme-change', onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('theme-change', onChange);
  };
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === 'dark',
    () => true,
  );
  const actionLabel = dark ? 'Ativar tema claro' : 'Ativar tema escuro';

  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(storageKey, theme); } catch { /* Keep the toggle usable. */ }
    window.dispatchEvent(new Event('theme-change'));
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme}
      aria-label={actionLabel} title={actionLabel}>
      <svg className="theme-moon" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      </svg>
      <svg className="theme-sun" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    </button>
  );
}
