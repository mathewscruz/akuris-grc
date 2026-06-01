import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Sparkles } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { useUpsertTarefa } from '@/hooks/useProjetoTarefas';
import type { ProjetoColuna, ProjetoTarefaPrioridade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';
import { toast } from 'sonner';

interface SuggestTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  colunas: ProjetoColuna[];
}

interface Sugestao {
  titulo: string;
  descricao?: string;
  prioridade?: ProjetoTarefaPrioridade;
  estimativa_horas?: number;
}

export const SuggestTasksDialog: React.FC<SuggestTasksDialogProps> = ({ open, onOpenChange, projetoId, colunas }) => {
  const [objetivo, setObjetivo] = useState('');
  const [contextoExtra, setContextoExtra] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const upsert = useUpsertTarefa();

  const handleGerar = async () => {
    if (objetivo.trim().length < 5) {
      toast.error('Descreva o objetivo (mín. 5 caracteres)');
      return;
    }
    setLoading(true);
    const { data, error } = await invokeEdgeFunction<{ tarefas: Sugestao[] }>('projeto-suggest-tasks', {
      body: { projetoId, objetivo, contextoExtra },
      isAiCall: true,
    });
    setLoading(false);
    if (error || !data) return;
    const tarefas = data.tarefas ?? [];
    setSugestoes(tarefas);
    setSelecionadas(new Set(tarefas.map((_, i) => i)));
  };

  const handleCriar = async () => {
    const primeiraColuna = colunas[0]?.id;
    if (!primeiraColuna) {
      toast.error('Projeto sem colunas configuradas');
      return;
    }
    const escolhidas = sugestoes.filter((_, i) => selecionadas.has(i));
    for (const s of escolhidas) {
      await upsert.mutateAsync({
        projeto_id: projetoId,
        coluna_id: primeiraColuna,
        titulo: s.titulo,
        descricao: s.descricao ?? null,
        prioridade: s.prioridade ?? 'media',
        estimativa_horas: s.estimativa_horas ?? null,
      });
    }
    toast.success(`${escolhidas.length} tarefa(s) criada(s)`);
    onOpenChange(false);
    setObjetivo('');
    setContextoExtra('');
    setSugestoes([]);
    setSelecionadas(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Quebrar objetivo em tarefas com IA</DialogTitle>
          <DialogDescription>A IA propõe tarefas acionáveis. Você escolhe quais criar. Consome 1 crédito.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex.: Implementar política de classificação de dados conforme LGPD" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Contexto adicional (opcional)</Label>
            <Textarea value={contextoExtra} onChange={(e) => setContextoExtra(e.target.value)} placeholder="Restrições, prazos, stakeholders…" rows={2} />
          </div>

          {sugestoes.length === 0 ? (
            <Button onClick={handleGerar} disabled={loading} className="w-full">
              {loading ? <AkurisPulse size={20} /> : <><Sparkles className="h-4 w-4 mr-2" />Gerar sugestões</>}
            </Button>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto rounded-md border border-border p-3">
              {sugestoes.map((s, i) => (
                <div key={i} className="flex gap-3 p-2 rounded hover:bg-muted/40">
                  <Checkbox
                    checked={selecionadas.has(i)}
                    onCheckedChange={(c) => {
                      const next = new Set(selecionadas);
                      c ? next.add(i) : next.delete(i);
                      setSelecionadas(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.titulo}</span>
                      {s.prioridade && <StatusBadge tone={s.prioridade === 'critica' ? 'destructive' : s.prioridade === 'alta' ? 'warning' : 'info'} size="sm">{PRIORIDADE_LABEL[s.prioridade]}</StatusBadge>}
                      {s.estimativa_horas && <span className="text-xs text-muted-foreground">{s.estimativa_horas}h</span>}
                    </div>
                    {s.descricao && <p className="text-sm text-muted-foreground mt-1">{s.descricao}</p>}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setSugestoes([]); setSelecionadas(new Set()); }}>Refazer</Button>
                <Button className="flex-1" disabled={selecionadas.size === 0} onClick={handleCriar}>
                  Criar {selecionadas.size} tarefa(s)
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
