/**
 * useBulkStatusUpdate — ação em lote de mudança de situação (item 3 do
 * plano "menos interações").
 *
 * Uma única regra para todos os módulos: atualiza `status` dos IDs
 * escolhidos, SEMPRE confinado à empresa da sessão, invalida as listas
 * afetadas e avisa pelo toast. Sem isto, cada módulo improvisaria a sua
 * atualização em lote — e era aí que o escopo de empresa se perdia.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

interface Options {
  /** Tabela alvo (ex.: 'riscos', 'incidentes'). */
  table: string;
  /** Query keys a invalidar depois da atualização. */
  queryKeys: string[];
}

export function useBulkStatusUpdate({ table, queryKeys }: Options) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const apply = async (ids: string[], status: string): Promise<boolean> => {
    const empresaId = profile?.empresa_id;
    if (!empresaId || ids.length === 0) return false;
    setBusy(true);
    const { error } = await (supabase.from as any)(table)
      .update({ status })
      .in('id', ids)
      .eq('empresa_id', empresaId);
    setBusy(false);
    if (error) {
      logger.error(`[bulk] falha ao atualizar ${table}`, error);
      toast.error(t('bulkActions.statusError'));
      return false;
    }
    queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    toast.success(t('bulkActions.statusApplied', { count: ids.length }));
    return true;
  };

  return { apply, busy };
}
