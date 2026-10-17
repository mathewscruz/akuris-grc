import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

/** Chave isolada por empresa + usuário + formulário: um rascunho nunca vaza entre empresas. */
export function draftKey(empresaId: string | null | undefined, userId: string | null | undefined, form: string) {
  if (!empresaId || !userId) return null;
  return `akuris:draft:${empresaId}:${userId}:${form}`;
}

/**
 * Guarda o rascunho no navegador enquanto a pessoa escreve (nada vai ao banco).
 * `enabled` deve ser falso para edição de registros existentes, se não fizer sentido.
 */
export function useDraftAutosave<T extends Record<string, unknown>>(form: string, values: T, enabled = true) {
  const { profile, user } = useAuth() as any;
  const key = draftKey(profile?.empresa_id, user?.id ?? profile?.user_id, form);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!key || !enabled) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setPending(JSON.parse(raw).values as T);
    } catch { /* rascunho corrompido: ignora */ }
  }, [key, enabled]);

  useEffect(() => {
    if (!key || !enabled) return;
    if (first.current) { first.current = false; return; }
    const id = setTimeout(() => {
      const temConteudo = Object.values(values).some((v) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0));
      if (!temConteudo) return;
      localStorage.setItem(key, JSON.stringify({ values, at: Date.now() }));
      setSavedAt(Date.now());
    }, 600);
    return () => clearTimeout(id);
  }, [key, enabled, JSON.stringify(values)]);

  const clear = useCallback(() => {
    if (key) localStorage.removeItem(key);
    setPending(null);
    setSavedAt(null);
  }, [key]);

  const dismiss = useCallback(() => setPending(null), []);

  return { savedAt, pendingDraft: pending, clear, dismiss };
}
