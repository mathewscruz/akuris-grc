/**
 * T4 · Parte B — Lista de constatações de um item (ou de toda a auditoria),
 * com geração de ação corretiva ligada ao registo real nos Planos de Ação.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { classificacaoTone } from '@/lib/constatacoes';
import { ConstatacaoDialog } from '@/components/auditorias/ConstatacaoDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { IconAdd, IconEdit, IconDelete, IconChecklist } from '@/components/icons';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
interface Props {
  auditoriaId: string;
  itemId?: string | null;
  itemTitulo?: string | null;
}

export function ConstatacoesPanel({ auditoriaId, itemId, itemTitulo }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emEdicao, setEmEdicao] = useState<any | null>(null);
  const [aEliminar, setAEliminar] = useState<any | null>(null);

  const { data: achados = [], isLoading } = useQuery({
    queryKey: ['auditoria-achados', auditoriaId, itemId ?? 'todos'],
    enabled: !!auditoriaId,
    queryFn: async () => {
      let query = supabase
        .from('auditoria_achados')
        .select('*')
        .eq('auditoria_id', auditoriaId)
        .order('created_at', { ascending: false });
      if (itemId) query = query.eq('item_id', itemId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ['planos-acao-achados', auditoriaId, empresaId],
    enabled: !!empresaId && achados.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos_acao')
        .select('id, registro_origem_id')
        .eq('empresa_id', empresaId!)
        .eq('modulo_origem', 'auditoria_achado')
        .in('registro_origem_id', achados.map((a: any) => a.id));
      if (error) throw error;
      return data || [];
    },
  });
  const comAcao = new Set(acoes.map((a: any) => a.registro_origem_id));

  const gerarAcao = useMutation({
    mutationFn: async (achado: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('planos_acao').insert({
        empresa_id: empresaId!,
        titulo: achado.titulo,
        descricao: achado.descricao || achado.evidencia_objetiva || null,
        status: 'pendente',
        // Severidade canónica -> prioridade de execução: dois vocabulários
        // distintos, com a tradução explícita entre eles.
        prioridade: ({ critico: 'critica', alto: 'alta', medio: 'media', baixo: 'baixa' } as const)[
          severidadeDeFaixas(achado.criticidade) as 'critico' | 'alto' | 'medio' | 'baixo'
        ] ?? 'media',
        modulo_origem: 'auditoria_achado',
        registro_origem_id: achado.id,
        registro_origem_titulo: itemTitulo || achado.titulo,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from('auditoria_achados')
        .update({ status: 'em_tratamento' })
        .eq('id', achado.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditoria-achados'] });
      queryClient.invalidateQueries({ queryKey: ['planos-acao-achados'] });
      queryClient.invalidateQueries({ queryKey: ['planos_acao'] });
      toast.success(t('t4.constatacoes.acaoCriada'));
    },
    onError: (error) => {
      logger.error('Erro ao criar ação corretiva', error);
      toast.error(t('t4.constatacoes.acaoErro'));
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auditoria_achados').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditoria-achados'] });
      toast.success(t('t4.constatacoes.eliminada'));
      setAEliminar(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t('t4.constatacoes.titulo')}</h4>
        <Button
          size="sm"
          onClick={() => {
            setEmEdicao(null);
            setDialogOpen(true);
          }}
        >
          <IconAdd className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
          {t('t4.constatacoes.nova')}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <AkurisPulse />
        </div>
      ) : achados.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {itemId ? t('t4.constatacoes.vazio') : t('t4.constatacoes.vazioAuditoria')}
        </Card>
      ) : (
        <div className="space-y-2">
          {achados.map((achado: any) => (
            <Card key={achado.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={classificacaoTone(achado.classificacao)}>
                      {t(`t4.constatacoes.classificacaoLabel.${achado.classificacao}`)}
                    </StatusBadge>
                    <span className="text-sm font-medium truncate">{achado.titulo}</span>
                  </div>
                  {achado.descricao && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{achado.descricao}</p>
                  )}
                  {achado.evidencia_objetiva && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{t('t4.constatacoes.campoEvidencia')}: </span>
                      {achado.evidencia_objetiva}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={comAcao.has(achado.id) || gerarAcao.isPending}
                    onClick={() => gerarAcao.mutate(achado)}
                  >
                    <IconChecklist className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
                    {comAcao.has(achado.id) ? t('t4.constatacoes.acaoExistente') : t('t4.constatacoes.gerarAcao')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEmEdicao(achado);
                      setDialogOpen(true);
                    }}
                  >
                    <IconEdit className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setAEliminar(achado)}>
                    <IconDelete className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConstatacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        auditoriaId={auditoriaId}
        itemId={itemId}
        achado={emEdicao}
      />

      <ConfirmDialog
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title={t('t4.constatacoes.confirmarEliminar')}
        description={t('t4.constatacoes.confirmarEliminarDesc')}
        onConfirm={() => aEliminar && eliminar.mutate(aEliminar.id)}
      />
    </div>
  );
}

