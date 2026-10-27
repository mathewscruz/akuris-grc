import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { undoableAction } from '@/lib/undoable-action';
import { logger } from '@/lib/logger';
import { motivoBloqueioTratado, podeMarcarTratado, resumirTratamentos, STATUS_TRATADO } from '@/components/riscos/risk-status';

/** Muda o status de um risco direto da tabela/painel, com "Desfazer". */
export function useAlterarStatusRisco() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState<string | null>(null);
  const empresaId = profile?.empresa_id;

  const alterar = useCallback(async (riscoId: string, novo: string) => {
    if (!empresaId) return false;
    if (novo === STATUS_TRATADO) {
      const { data, error } = await supabase
        .from('riscos_tratamentos').select('status').eq('risco_id', riscoId).eq('empresa_id', empresaId);
      if (error) { toast.error(t('riscos.page.move.error')); return false; }
      const resumo = resumirTratamentos(data ?? []);
      if (!podeMarcarTratado(resumo)) { toast.error(motivoBloqueioTratado(resumo)); return false; }
    }
    const label = t(`riscos.page.status.${novo}`);
    setSalvando(riscoId);
    try {
      return await undoableAction({
        message: t('riscos.page.move.changed', { status: label }),
        undoLabel: t('riscos.page.move.undo'),
        durationMs: 4000,
        onCommit: async () => {
          const { error } = await supabase.from('riscos')
            .update({ status: novo }).eq('id', riscoId).eq('empresa_id', empresaId);
          if (error) throw error;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['riscos'] }),
            queryClient.invalidateQueries({ queryKey: ['risco-detail', riscoId] }),
          ]);
        },
      });
    } catch (e) {
      logger.error('Falha ao alterar status do risco', e);
      toast.error(t('riscos.page.move.error'));
      return false;
    } finally {
      setSalvando(null);
    }
  }, [empresaId, queryClient, t]);

  return { alterar, salvando };
}
