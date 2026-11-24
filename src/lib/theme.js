import { useCallback, useEffect, useState } from 'react';

const KEY = 'arems-theme';
const read = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } };

const systemTheme = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Follows the OS setting until the user picks a theme, then remembers the pick.
export const useTheme = () => {
  const [theme, setTheme] = useState(() => read(KEY) || systemTheme());
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggle = useCallback(() => setTheme(t => { const next = t === 'dark' ? 'light' : 'dark'; write(KEY, next); return next; }), []);
  return [theme, toggle];
};

// A boolean that survives reloads (sidebar collapsed, view toggles).
export const useStoredFlag = (key, initial = false) => {
  const [value, setValue] = useState(() => { const v = read(key); return v === null ? initial : v === '1'; });
  const set = useCallback((next) => setValue(prev => { const v = typeof next === 'function' ? next(prev) : next; write(key, v ? '1' : '0'); return v; }), [key]);
  return [value, set];
};
