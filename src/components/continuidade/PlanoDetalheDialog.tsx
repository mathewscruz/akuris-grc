import { useState } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, ClipboardList, TestTube, Clock, Target, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly } from '@/lib/date-utils';
import { TarefaDialog } from './TarefaDialog';
import { TesteDialog } from './TesteDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

interface PlanoDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: any;
}

const statusMap: Record<string, { label: string; tone: StatusTone }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  ativo: { label: 'Ativo', tone: 'success' },
  em_revisao: { label: 'Em Revisão', tone: 'warning' },
  desativado: { label: 'Desativado', tone: 'destructive' },
};

const prioridadeMap: Record<string, { label: string; tone: StatusTone }> = {
  baixa: { label: 'Baixa', tone: 'neutral' },
  media: { label: 'Média', tone: 'info' },
  alta: { label: 'Alta', tone: 'warning' },
  critica: { label: 'Crítica', tone: 'destructive' },
};

const tipoTesteMap: Record<string, string> = {
  tabletop: 'Tabletop',
  simulacao: 'Simulação',
  real: 'Teste Real',
};

const resultadoMap: Record<string, { label: string; tone: StatusTone }> = {
  aprovado: { label: 'Aprovado', tone: 'success' },
  reprovado: { label: 'Reprovado', tone: 'destructive' },
  parcial: { label: 'Parcial', tone: 'warning' },
};

export function PlanoDetalheDialog({ open, onOpenChange, plano }: PlanoDetalheDialogProps) {
  const { toast } = useToast();
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
      toast({ title: `${deleteConfirm.type === 'tarefa' ? 'Tarefa' : 'Teste'} excluído` });
      refreshData();
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
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
        icon={ShieldCheck}
        title={plano.nome}
        size="lg"
        hideFooter
      >
          <div className="flex items-center gap-2 mb-4">
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
            <StatusBadge tone="neutral" variant="outline">{plano.tipo === 'bcp' ? 'BCP' : plano.tipo === 'drp' ? 'DRP' : 'BCP + DRP'}</StatusBadge>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
            {plano.rto_horas != null && (
              <Card className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> RTO</div>
                <p className="text-lg font-semibold mt-1">{plano.rto_horas}h</p>
              </Card>
            )}
            {plano.rpo_horas != null && (
              <Card className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" /> RPO</div>
                <p className="text-lg font-semibold mt-1">{plano.rpo_horas}h</p>
              </Card>
            )}
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="h-4 w-4" /> Tarefas</div>
              <p className="text-lg font-semibold mt-1">{tarefas.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><TestTube className="h-4 w-4" /> Testes</div>
              <p className="text-lg font-semibold mt-1">{testes.length}</p>
            </Card>
          </div>

          {plano.descricao && <p className="text-sm text-muted-foreground mb-4">{plano.descricao}</p>}

          <Tabs defaultValue="tarefas">
            <TabsList>
              <TabsTrigger value="tarefas">Tarefas ({tarefas.length})</TabsTrigger>
              <TabsTrigger value="testes">Testes ({testes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tarefas" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTarefaDialog({ open: true })}>
                  <Plus className="h-4 w-4 mr-1" /> Tarefa
                </Button>
              </div>
              {tarefas.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma tarefa cadastrada</p>
              ) : (
                tarefas.map((t: any) => {
                  const pri = prioridadeMap[t.prioridade] || prioridadeMap.media;
                  return (
                    <Card key={t.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{t.titulo}</span>
                            <StatusBadge tone={pri.tone} size="sm">{pri.label}</StatusBadge>
                            <StatusBadge tone={t.status === 'concluida' ? 'success' : t.status === 'em_andamento' ? 'info' : 'neutral'} size="sm">
                              {t.status === 'pendente' ? 'Pendente' : t.status === 'em_andamento' ? 'Em Andamento' : 'Concluída'}
                            </StatusBadge>
                          </div>
                          {t.descricao && <p className="text-xs text-muted-foreground mt-1">{t.descricao}</p>}
                          {t.prazo && <p className="text-xs text-muted-foreground mt-1">Prazo: {formatDateOnly(t.prazo)}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTarefaDialog({ open: true, tarefa: t })}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, type: 'tarefa', id: t.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="testes" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTesteDialog({ open: true })}>
                  <Plus className="h-4 w-4 mr-1" /> Teste
                </Button>
              </div>
              {testes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum teste registrado</p>
              ) : (
                testes.map((t: any) => {
                  const res = t.resultado ? (resultadoMap[t.resultado] || { label: t.resultado, tone: 'neutral' as StatusTone }) : null;
                  return (
                    <Card key={t.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{tipoTesteMap[t.tipo_teste] || t.tipo_teste}</span>
                            <StatusBadge tone="neutral" variant="outline" size="sm">{formatDateOnly(t.data_teste)}</StatusBadge>
                            {res && <StatusBadge tone={res.tone} size="sm">{res.label}</StatusBadge>}
                          </div>
                          {t.descricao && <p className="text-xs text-muted-foreground mt-1">{t.descricao}</p>}
                          {t.licoes_aprendidas && <p className="text-xs text-muted-foreground mt-1"><strong>Lições:</strong> {t.licoes_aprendidas}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTesteDialog({ open: true, teste: t })}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, type: 'teste', id: t.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
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
        title="Confirmar exclusão"
        description={`Deseja excluir ${deleteConfirm.type === 'tarefa' ? 'esta tarefa' : 'este teste'}?`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
