import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { motivoBloqueioTratado, podeMarcarTratado, resumirTratamentos, STATUS_TRATADO } from '@/components/riscos/risk-status';

/** Muda o status de um risco direto da tabela/painel, com "Desfazer". */
export function useAlterarStatusRisco() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState<string | null>(null);
  const empresaId = profile?.empresa_id;

  const alterar = useCallback(async (riscoId: string, novo: string, anterior?: string) => {
    if (!empresaId) return false;
    if (novo === STATUS_TRATADO) {
      const { data, error } = await supabase
        .from('riscos_tratamentos').select('status').eq('risco_id', riscoId);
      if (error) { toast.error(t('riscos.page.move.error')); return false; }
      const resumo = resumirTratamentos(data ?? []);
      if (!podeMarcarTratado(resumo)) { toast.error(motivoBloqueioTratado(resumo)); return false; }
    }
    const label = t(`riscos.page.status.${novo}`);
    const listKey = ['riscos', empresaId];
    const aplicarLocal = (status: string) => queryClient.setQueryData<any[]>(listKey, (old) =>
      Array.isArray(old) ? old.map((r) => (r.id === riscoId ? { ...r, status, status_efetivo: status, status_ajuste_motivo: null } : r)) : old);
    const gravar = async (status: string) => {
      const { error } = await supabase.from('riscos').update({ status }).eq('id', riscoId).eq('empresa_id', empresaId);
      if (error) throw error;
    };
    const sincronizar = () => {
      queryClient.invalidateQueries({ queryKey: ['riscos'] });
      queryClient.invalidateQueries({ queryKey: ['risco-detail', riscoId] });
    };
    // Mudança otimista: a tela troca na hora; "Desfazer" grava o status anterior.
    aplicarLocal(novo);
    setSalvando(riscoId);
    try {
      await gravar(novo);
      toast(t('riscos.page.move.changed', { status: label }), {
        duration: 5000,
        action: anterior && anterior !== novo ? {
          label: t('riscos.page.move.undo'),
          onClick: async () => {
            aplicarLocal(anterior);
            try { await gravar(anterior); } catch { toast.error(t('riscos.page.move.error')); }
            sincronizar();
          },
        } : undefined,
      });
      sincronizar();
      return true;
    } catch (e) {
      logger.error('Falha ao alterar status do risco', { error: String(e) });
      if (anterior) aplicarLocal(anterior);
      toast.error(t('riscos.page.move.error'));
      return false;
    } finally {
      setSalvando(null);
    }
  }, [empresaId, queryClient, t]);

  return { alterar, salvando };
}
