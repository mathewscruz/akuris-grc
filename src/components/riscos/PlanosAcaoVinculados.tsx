/**
 * Planos de ação ligados a um registo (hoje usado no painel do risco).
 *
 * Lê pela chave estrangeira `registro_origem_id` e mantém compatibilidade com
 * ações antigas, que só têm o título em `registro_origem_titulo`.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
;
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { resolvePrioridadeTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { PlanoAcaoDialog } from '@/components/planos-acao/PlanoAcaoDialog';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { IconAdd, IconExternal } from '@/components/icons';

interface Props {
  /** Módulo de origem tal como gravado em `planos_acao.modulo_origem`. */
  modulo: string;
  registroId: string;
  registroTitulo: string;
  /** Título legado para casar ações antigas sem chave estrangeira. */
  tituloLegado?: string;
  /*
     Quem cria o plano.

     No risco havia duas portas para o mesmo destino: o botão «Novo
     tratamento», que já criava o plano por si, e o «Criar plano de
     ação» aqui ao lado. Ficaram os dois na mesma aba, e quem chegava
     tinha de adivinhar por qual começar. No risco o plano passa a
     nascer do tratamento, e este painel mostra o que de lá veio.

     Nos controlos não há tratamento nenhum: lá esta continua a ser a
     única porta, e por isso o valor por omissão é poder criar.
  */
  permitirCriar?: boolean;
  /** Explica de onde vêm os planos quando não se criam aqui. */
  vazioTexto?: string;
}

export function PlanosAcaoVinculados({ modulo, registroId, registroTitulo, tituloLegado, permitirCriar = true, vazioTexto }: Props) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const empresaId = profile?.empresa_id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ['planos-acao-vinculados', modulo, registroId, empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const filtroLegado = tituloLegado
        ? `,and(modulo_origem.eq.${modulo},registro_origem_titulo.ilike.%${tituloLegado.replace(/[,%]/g, ' ')}%)`
        : '';
      const { data, error } = await supabase
        .from('planos_acao')
        .select('id, titulo, status, prioridade, prazo, registro_origem_id')
        .eq('empresa_id', empresaId)
        .or(`registro_origem_id.eq.${registroId}${filtroLegado}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId && !!registroId,
  });

  const handleSave = async (data: any) => {
    if (!empresaId || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('planos_acao').insert({
        ...data,
        empresa_id: empresaId,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t('planosAcao.toastCreated'));
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['planos-acao-vinculados'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
    } catch (error) {
      logger.error('Erro ao criar plano de ação vinculado', error);
      toast.error(t('planosAcao.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">
          {t('planosVinculados.title')}
          {planos.length > 0 && <span className="ml-1.5 text-foreground">({planos.length})</span>}
        </h4>
        {permitirCriar && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
            <IconAdd className="h-3 w-3" /> {t('planosVinculados.create')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><AkurisPulse size={20} /></div>
      ) : planos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazioTexto ?? t('planosVinculados.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {planos.map((p: any) => (
            <li
              key={p.id}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
              onClick={() => navigate(`/planos-acao?focus=${p.id}`)}
            >
              <span className="min-w-0 flex-1 truncate">{p.titulo}</span>
              <StatusBadge {...resolvePrioridadeTone(p.prioridade)}>{formatStatus(p.status)}</StatusBadge>
              <IconExternal className="h-3 w-3 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ul>
      )}

      <PlanoAcaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
        origemInicial={{ modulo, registroId, registroTitulo }}
      />
    </section>
  );
}
