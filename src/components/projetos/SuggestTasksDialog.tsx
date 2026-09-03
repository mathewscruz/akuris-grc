import { IconChecklist } from '@/components/icons';
import React, { useState } from 'react';

import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
;
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { useUpsertTarefa } from '@/hooks/useProjetoTarefas';
import type { ProjetoColuna, ProjetoTarefaPrioridade } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus } from '@/lib/text-utils';

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
  const { t } = useLanguage();
  const [objetivo, setObjetivo] = useState('');
  const [contextoExtra, setContextoExtra] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const upsert = useUpsertTarefa();

  const handleGerar = async () => {
    if (objetivo.trim().length < 5) {
      toast.error(t('projetos.suggestTasks.objectiveErrorMin'));
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
      toast.error(t('projetos.suggestTasks.noColumnsError'));
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
    toast.success(t('projetos.suggestTasks.createdSuccess', { count: escolhidas.length }));
    onOpenChange(false);
    setObjetivo('');
    setContextoExtra('');
    setSugestoes([]);
    setSelecionadas(new Set());
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      title={t('projetos.suggestTasks.title')}
      description={t('projetos.suggestTasks.description')}
      size="md"
      hideFooter
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="objetivo">{t('projetos.suggestTasks.objective')}</Label>
            <Textarea id="objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder={t('projetos.suggestTasks.objectivePlaceholder')} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contextoExtra">{t('projetos.suggestTasks.extraContext')}</Label>
            <Textarea id="contextoExtra" value={contextoExtra} onChange={(e) => setContextoExtra(e.target.value)} placeholder={t('projetos.suggestTasks.extraContextPlaceholder')} rows={2} />
          </div>

          {sugestoes.length === 0 ? (
            <Button onClick={handleGerar} disabled={loading} className="w-full">
              {loading ? <AkurisPulse size={20} /> : <>{t('projetos.suggestTasks.generateSuggestions')}</>}
            </Button>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto rounded-md border border-border p-3">
              {sugestoes.map((s, i) => (
                <div key={i} className="flex gap-3 p-2 rounded hover:bg-accent">
                  <Checkbox
                    checked={selecionadas.has(i)}
                    onCheckedChange={(c) => {
                      const next = new Set(selecionadas);
                      if (c) next.add(i);
                      else next.delete(i);
                      setSelecionadas(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.titulo}</span>
                      {s.prioridade && <StatusBadge tone={s.prioridade === 'critica' ? 'destructive' : s.prioridade === 'alta' ? 'warning' : 'info'}>{PRIORIDADE_LABEL[s.prioridade] ?? formatStatus(s.prioridade)}</StatusBadge>}
                      {s.estimativa_horas && <span className="text-xs text-muted-foreground">{s.estimativa_horas}h</span>}
                    </div>
                    {s.descricao && <p className="text-sm text-muted-foreground mt-1">{s.descricao}</p>}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setSugestoes([]); setSelecionadas(new Set()); }}>{t('projetos.suggestTasks.redo')}</Button>
                <Button className="flex-1" disabled={selecionadas.size === 0} onClick={handleCriar}>
                  {t('projetos.suggestTasks.createTasks', { count: selecionadas.size })}
                </Button>
              </div>
            </div>
          )}
        </div>
    </DialogShell>
  );
};
