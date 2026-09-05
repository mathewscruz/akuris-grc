import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'akuris-reduce-motion';
const listeners = new Set<() => void>();
const readPreference = () => { try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; } };
let preference = readPreference();
const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
let hidden = typeof document !== 'undefined' && document.hidden;
let dispose: (() => void) | undefined;
const reduced = () => preference || !!media?.matches;

function publish() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.reduceMotion = String(reduced());
    document.documentElement.dataset.motionHidden = String(hidden);
  }
  listeners.forEach((listener) => listener());
}

/** Runs before the first render; the preference applies to public pages too. */
export function initializeMotionPreferences() {
  if (dispose || typeof window === 'undefined') return;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) { preference = readPreference(); publish(); }
  };
  const onVisibility = () => { hidden = document.hidden; publish(); };
  media?.addEventListener?.('change', publish);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  publish();
  dispose = () => {
    media?.removeEventListener?.('change', publish);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
    dispose = undefined;
  };
}

export function setReducedMotionPreference(value: boolean) {
  preference = value;
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* The in-memory setting still works. */ }
  publish();
}

function subscribe(listener: () => void) {
  initializeMotionPreferences();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const serverSnapshot = () => true;
export const useMotionAllowed = () => useSyncExternalStore(subscribe, () => !reduced() && !hidden, () => false);
export function useMotionPreference() {
  const selected = useSyncExternalStore(subscribe, () => preference, () => false);
  const systemReduced = useSyncExternalStore(subscribe, () => !!media?.matches, serverSnapshot);
  return { selected, systemReduced, setSelected: setReducedMotionPreference };
}

if (import.meta.hot) import.meta.hot.dispose(() => dispose?.());
