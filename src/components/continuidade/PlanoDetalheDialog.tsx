import { useState } from 'react';
import { IconAdd, IconEdit, IconDelete, IconTime, IconChecklist, IconTest, IconTarget, IconShieldCheck } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { TarefaDialog } from './TarefaDialog';
import { TesteDialog } from './TesteDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';
import { PreparacaoContinuidade } from './PreparacaoContinuidade';

interface PlanoDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: any;
  onSuccess?: () => void;
}

export function PlanoDetalheDialog({ open, onOpenChange, plano, onSuccess }: PlanoDetalheDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const statusMap: Record<string, { label: string; tone: StatusTone }> = {
    rascunho: { label: t('continuidadeComp.status.rascunho'), tone: 'neutral' },
    ativo: { label: t('continuidadeComp.status.ativo'), tone: 'success' },
    em_revisao: { label: t('continuidadeComp.status.em_revisao'), tone: 'warning' },
    desativado: { label: t('continuidadeComp.status.desativado'), tone: 'destructive' },
  };

  const prioridadeMap: Record<string, { label: string; tone: StatusTone }> = {
    baixa: { label: t('continuidadeComp.prioridade.baixa'), tone: 'neutral' },
    media: { label: t('continuidadeComp.prioridade.media'), tone: 'info' },
    alta: { label: t('continuidadeComp.prioridade.alta'), tone: 'warning' },
    critica: { label: t('continuidadeComp.prioridade.critica'), tone: 'destructive' },
  };

  const tipoTesteMap: Record<string, string> = {
    tabletop: t('continuidadeComp.tipoTeste.tabletop'),
    simulacao: t('continuidadeComp.tipoTeste.simulacao'),
    real: t('continuidadeComp.tipoTeste.real'),
  };

  const resultadoMap: Record<string, { label: string; tone: StatusTone }> = {
    aprovado: { label: t('continuidadeComp.resultado.aprovado'), tone: 'success' },
    reprovado: { label: t('continuidadeComp.resultado.reprovado'), tone: 'destructive' },
    parcial: { label: t('continuidadeComp.resultado.parcial'), tone: 'warning' },
  };

  const queryClient = useQueryClient();
  const [tarefaDialog, setTarefaDialog] = useState<{ open: boolean; tarefa?: any }>({ open: false });
  const [testeDialog, setTesteDialog] = useState<{ open: boolean; teste?: any }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string }>({ open: false, type: '', id: '' });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['continuidade-tarefas', plano?.id],
    queryFn: async () => {
      const { data } = await supabase.from('continuidade_tarefas').select('*').eq('plano_id', plano.id).order('ordem', { ascending: true });
      return data || [];
    },
    enabled: !!plano?.id && open,
  });

  const { data: testes = [] } = useQuery({
    queryKey: ['continuidade-testes', plano?.id],
    queryFn: async () => {
      const { data } = await supabase.from('continuidade_testes').select('*').eq('plano_id', plano.id).order('data_teste', { ascending: false });
      return data || [];
    },
    enabled: !!plano?.id && open,
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['continuidade-tarefas', plano?.id] });
    queryClient.invalidateQueries({ queryKey: ['continuidade-testes', plano?.id] });
    queryClient.invalidateQueries({ queryKey: ['continuidade-stats'] });
  };

  const handleDelete = async () => {
    try {
      const table = deleteConfirm.type === 'tarefa' ? 'continuidade_tarefas' : 'continuidade_testes';
      const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast({ title: t('continuidadeComp.detalhe.toastDeleted', { tipo: deleteConfirm.type === 'tarefa' ? t('continuidadeComp.detalhe.labelTarefa') : t('continuidadeComp.detalhe.labelTeste') }) });
      refreshData();
    } catch (error: any) {
      toast({ title: t('continuidadeComp.detalhe.toastDeleteError'), description: error.message, variant: 'destructive' });
    }
    setDeleteConfirm({ open: false, type: '', id: '' });
  };

  if (!plano) return null;

  const st = statusMap[plano.status] || statusMap.rascunho;

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        icon={IconShieldCheck}
        title={plano.nome}
        size="lg"
        hideFooter
      >
          <div className="flex items-center gap-2 mb-4">
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            <StatusBadge tone="neutral" variant="outline">{plano.tipo === 'bcp' ? t('continuidadeComp.detalhe.tipoBcp') : plano.tipo === 'drp' ? t('continuidadeComp.detalhe.tipoDrp') : t('continuidadeComp.detalhe.tipoAmbos')}</StatusBadge>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
            {plano.rto_horas != null && (
              <Card className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><IconTime className="h-4 w-4" /> {t('continuidadeComp.detalhe.rto')}</div>
                <p className="text-lg font-semibold mt-1">{plano.rto_horas}h</p>
              </Card>
            )}
            {plano.rpo_horas != null && (
              <Card className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><IconTarget className="h-4 w-4" /> {t('continuidadeComp.detalhe.rpo')}</div>
                <p className="text-lg font-semibold mt-1">{plano.rpo_horas}h</p>
              </Card>
            )}
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><IconChecklist className="h-4 w-4" /> {t('continuidadeComp.detalhe.tarefas')}</div>
              <p className="text-lg font-semibold mt-1">{tarefas.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><IconTest className="h-4 w-4" /> {t('continuidadeComp.detalhe.testes')}</div>
              <p className="text-lg font-semibold mt-1">{testes.length}</p>
            </Card>
          </div>

          {plano.descricao && <p className="text-sm text-muted-foreground mb-4">{plano.descricao}</p>}

          <Tabs defaultValue="preparacao">
            <TabsList>
              <TabsTrigger value="preparacao">{t('continuidadeComp.detalhe.tabPreparacao')}</TabsTrigger>
              <TabsTrigger value="tarefas">{t('continuidadeComp.detalhe.tabTarefas', { count: tarefas.length })}</TabsTrigger>
              <TabsTrigger value="testes">{t('continuidadeComp.detalhe.tabTestes', { count: testes.length })}</TabsTrigger>
            </TabsList>

            <TabsContent value="preparacao">
              <PreparacaoContinuidade plano={plano} onSuccess={onSuccess} />
            </TabsContent>

            <TabsContent value="tarefas" className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTarefaDialog({ open: true })}>
                  <IconAdd className="h-4 w-4 mr-1" /> {t('continuidadeComp.detalhe.buttonTarefa')}
                </Button>
              </div>
              {tarefas.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t('continuidadeComp.detalhe.emptyTarefas')}</p>
              ) : (
                tarefas.map((tarefa: any) => {
                  const pri = prioridadeMap[tarefa.prioridade] || prioridadeMap.media;
                  return (
                    <Card key={tarefa.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{tarefa.titulo}</span>
                            <StatusBadge tone={pri.tone}>{pri.label}</StatusBadge>
                            <StatusBadge tone={tarefa.status === 'concluida' ? 'success' : tarefa.status === 'em_andamento' ? 'info' : 'neutral'}>
                              {tarefa.status === 'pendente' ? t('continuidadeComp.detalhe.statusPendente') : tarefa.status === 'em_andamento' ? t('continuidadeComp.detalhe.statusEmAndamento') : t('continuidadeComp.detalhe.statusConcluida')}
                            </StatusBadge>
                          </div>
                          {tarefa.descricao && <p className="text-xs text-muted-foreground mt-1">{tarefa.descricao}</p>}
                          {tarefa.prazo && <p className="text-xs text-muted-foreground mt-1">{t('continuidadeComp.detalhe.prazoPrefix')}: {formatDateOnly(tarefa.prazo)}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTarefaDialog({ open: true, tarefa })} aria-label={t('common.edit')} title={t('common.edit')}>
                            <IconEdit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, type: 'tarefa', id: tarefa.id })} aria-label={t('common.delete')} title={t('common.delete')}>
                            <IconDelete className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="testes" className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTesteDialog({ open: true })}>
                  <IconAdd className="h-4 w-4 mr-1" /> {t('continuidadeComp.detalhe.buttonTeste')}
                </Button>
              </div>
              {testes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t('continuidadeComp.detalhe.emptyTestes')}</p>
              ) : (
                testes.map((teste: any) => {
                  const res = teste.resultado ? (resultadoMap[teste.resultado] || { label: formatStatus(teste.resultado), tone: 'neutral' as StatusTone }) : null;
                  return (
                    <Card key={teste.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{tipoTesteMap[teste.tipo_teste] || teste.tipo_teste}</span>
                            <StatusBadge tone="neutral" variant="outline">{formatDateOnly(teste.data_teste)}</StatusBadge>
                            {res && <StatusBadge tone={res.tone}>{res.label}</StatusBadge>}
                          </div>
                          {teste.descricao && <p className="text-xs text-muted-foreground mt-1">{teste.descricao}</p>}
                          {teste.licoes_aprendidas && <p className="text-xs text-muted-foreground mt-1"><strong>{t('continuidadeComp.detalhe.licoesPrefix')}:</strong> {teste.licoes_aprendidas}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTesteDialog({ open: true, teste })} aria-label={t('common.edit')} title={t('common.edit')}>
                            <IconEdit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, type: 'teste', id: teste.id })} aria-label={t('common.delete')} title={t('common.delete')}>
                            <IconDelete className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
      </DialogShell>

      <TarefaDialog
        open={tarefaDialog.open}
        onOpenChange={o => setTarefaDialog(p => ({ ...p, open: o }))}
        planoId={plano.id}
        tarefa={tarefaDialog.tarefa}
        onSuccess={refreshData}
      />

      <TesteDialog
        open={testeDialog.open}
        onOpenChange={o => setTesteDialog(p => ({ ...p, open: o }))}
        planoId={plano.id}
        teste={testeDialog.teste}
        onSuccess={refreshData}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={o => setDeleteConfirm(p => ({ ...p, open: o }))}
        title={t('continuidadeComp.detalhe.confirmDeleteTitle')}
        description={deleteConfirm.type === 'tarefa' ? t('continuidadeComp.detalhe.confirmDeleteTarefa') : t('continuidadeComp.detalhe.confirmDeleteTeste')}
        confirmText={t('continuidadeComp.detalhe.confirmDeleteConfirm')}
        cancelText={t('continuidadeComp.detalhe.confirmDeleteCancel')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
