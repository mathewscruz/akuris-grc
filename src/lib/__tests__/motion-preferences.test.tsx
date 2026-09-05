import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const system = vi.hoisted(() => {
  const state = { matches: false, change: () => {} };
  window.matchMedia = (() => ({
    get matches() { return state.matches; },
    addEventListener: (_event: string, fn: () => void) => { state.change = fn; },
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  return state;
});
import { initializeMotionPreferences, setReducedMotionPreference, useMotionAllowed, useMotionPreference } from '../motion-preferences';
import { AnimatedMetricValue } from '@/components/ui/stat-strip';
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/dashboard/KpiDrillDownProvider', () => ({ useKpiDrillDown: () => ({ open: vi.fn() }) }));

afterEach(() => { cleanup(); system.matches = false; setReducedMotionPreference(false); system.change(); vi.restoreAllMocks(); });

it('aplica a preferência imediatamente e a guarda apenas neste navegador', () => {
  initializeMotionPreferences();
  const { result } = renderHook(useMotionPreference);
  act(() => result.current.setSelected(true));
  expect(result.current.selected).toBe(true);
  expect(document.documentElement).toHaveAttribute('data-reduce-motion', 'true');
  expect(localStorage.getItem('akuris-reduce-motion')).toBe('true');
  render(<AnimatedMetricValue value="78%" />);
  expect(screen.getByText('78%')).toBeInTheDocument();
});
it('não permite que a preferência do app desative a redução de movimento do dispositivo', () => {
  const { result } = renderHook(useMotionAllowed);
  act(() => { system.matches = true; system.change(); setReducedMotionPreference(false); });
  expect(result.current).toBe(false);
  expect(document.documentElement).toHaveAttribute('data-reduce-motion', 'true');
});
it('sincroniza outra aba e suspende animações enquanto a página está oculta', () => {
  const { result } = renderHook(useMotionPreference);
  act(() => {
    localStorage.setItem('akuris-reduce-motion', 'true');
    window.dispatchEvent(new StorageEvent('storage', { key: 'akuris-reduce-motion', newValue: 'true' }));
  });
  expect(result.current.selected).toBe(true);
  const visible = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(document.documentElement).toHaveAttribute('data-motion-hidden', 'true');
  visible.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(document.documentElement).toHaveAttribute('data-motion-hidden', 'false');
});
