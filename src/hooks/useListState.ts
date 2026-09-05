import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';

// Somente preferências de navegação em memória; nunca registros nem credenciais.
const states = new Map<string, unknown>();
export function useListState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const scope = `${user?.id ?? 'guest'}:${profile?.empresa_id ?? ''}:${pathname}:${key}`;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const read = useCallback(() => states.has(scope) ? states.get(scope) as T : typeof initialRef.current === 'function' ? (initialRef.current as () => T)() : initialRef.current, [scope]);
  const [entry, setEntry] = useState(() => ({ scope, value: read() }));
  const value = entry.scope === scope ? entry.value : read();
  useEffect(() => {
    if (entry.scope !== scope) return;
    states.set(scope, entry.value);
    if (states.size > 250) states.delete(states.keys().next().value!);
  }, [entry, scope]);
  const setValue: Dispatch<SetStateAction<T>> = useCallback((next) => setEntry((previous) => {
    const current = previous.scope === scope ? previous.value : read();
    return { scope, value: typeof next === 'function' ? (next as (value: T) => T)(current) : next };
  }), [scope, read]);
  return [value, setValue];
}
