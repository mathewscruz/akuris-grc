import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/components/AuthProvider';

interface UseWizardDraftOptions<T> {
  /** Unique key per form type (e.g. "incidente", "controle") */
  storageKey: string;
  /** Optional record id for edit mode — drafts only auto-load for new records */
  recordId?: string | null;
  /** Current form values to persist */
  values: T;
  /** Whether auto-save is enabled */
  enabled?: boolean;
  /** Debounce in ms before persisting */
  debounceMs?: number;
}

const DRAFT_PREFIX = 'akuris:draft:';
/** Rascunho isolado por empresa e usuário: num navegador partilhado, uma empresa nunca vê o rascunho de outra. */
export function scopedDraftKey(empresaId: string | null | undefined, userId: string | null | undefined, storageKey: string) {
  return `${DRAFT_PREFIX}${empresaId ?? 'sem-empresa'}:${userId ?? 'anon'}:${storageKey}`;
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftEnvelope<T> {
  values: T;
  savedAt: number;
}

/**
 * Persists form drafts to localStorage with debounce + TTL.
 * Only stores drafts for NEW records (recordId is null/undefined).
 */
export function useWizardDraft<T extends object>({
  storageKey,
  recordId,
  values,
  enabled = true,
  debounceMs = 800,
}: UseWizardDraftOptions<T>) {
  const { profile, user } = useAuth() as { profile?: { empresa_id?: string | null } | null; user?: { id?: string } | null };
  const fullKey = scopedDraftKey(profile?.empresa_id, user?.id, storageKey);
  const [hasDraft, setHasDraft] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const isEditMode = !!recordId;

  // Detect existing draft on mount
  useEffect(() => {
    if (!enabled || isEditMode) return;
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return;
      const env = JSON.parse(raw) as DraftEnvelope<T>;
      if (Date.now() - env.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(fullKey);
        return;
      }
      setHasDraft(true);
      setSavedAt(env.savedAt);
    } catch (err) {
      logger.warn('[useWizardDraft] failed to read draft', err);
    }
  }, [fullKey, enabled, isEditMode]);

  // Debounced persist
  useEffect(() => {
    if (!enabled || isEditMode) return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      try {
        const env: DraftEnvelope<T> = { values, savedAt: Date.now() };
        localStorage.setItem(fullKey, JSON.stringify(env));
        setSavedAt(env.savedAt);
      } catch (err) {
        logger.warn('[useWizardDraft] failed to save draft', err);
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, fullKey, debounceMs, enabled, isEditMode]);

  const loadDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return null;
      const env = JSON.parse(raw) as DraftEnvelope<T>;
      return env.values;
    } catch {
      return null;
    }
  }, [fullKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(fullKey);
      setHasDraft(false);
      setSavedAt(null);
    } catch (err) {
      logger.warn('[useWizardDraft] failed to clear draft', err);
    }
  }, [fullKey]);

  return { hasDraft, savedAt, loadDraft, clearDraft };
}
