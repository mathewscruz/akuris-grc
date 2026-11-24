import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useContagemEvidencias } from '@/hooks/useProjetoExtras';
import { aplicarArrasto, fimDe, diferencaDias } from '@/lib/projeto-cronograma';
import { segundaDaSemana, diasDaSemana, posicaoNaSemana } from '@/lib/minha-semana';
import { formatarDiaParaDB, intlLocale } from '@/lib/date-utils';
import { somarDias } from '@/lib/projeto-cronograma';
import { undoableAction } from '@/lib/undoable-action';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TarefaSemana {
  id: string; titulo: string; projeto_id: string; data_inicio: string | null; data_fim: string | null;
  prazo: string | null; concluida_em: string | null; prioridade: string; projetos?: { nome: string; exigir_evidencia: boolean };
}

/** Semana do utilizador: tarefas de todos os projetos por dia de vencimento, com arrastar para mudar prazo. */
export function MinhaSemana() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const hojeISO = formatarDiaParaDB(new Date());
  const [segunda, setSegunda] = useState(() => segundaDaSemana(hojeISO));
  const [sobre, setSobre] = useState<string | null>(null);
  const key = ['minha-semana', user?.id, empresaId];

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user?.id && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('projeto_tarefas' as any)
        .select('id, titulo, projeto_id, data_inicio, data_fim, prazo, concluida_em, prioridade, projetos!inner(nome, empresa_id, exigir_evidencia)')
        .eq('projetos.empresa_id', empresaId!).eq('responsavel_id', user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as TarefaSemana[];
    },
  });
  const { data: evid = {} } = useContagemEvidencias(tarefas.filter((x) => x.concluida_em).map((x) => x.id));

  const dias = diasDaSemana(segunda);
  const { porDia, andamento } = useMemo(() => {
    const porDia: Record<string, TarefaSemana[]> = {}; const andamento: TarefaSemana[] = [];
    tarefas.forEach((x) => {
      const p = posicaoNaSemana(x, segunda);
      if (p?.tipo === 'dia') (porDia[p.dia] ??= []).push(x);
      else if (p?.tipo === 'andamento') andamento.push(x);
    });
    return { porDia, andamento };
  }, [tarefas, segunda]);

  const naSemana = Object.values(porDia).flat();
  const aConcluir = naSemana.filter((x) => !x.concluida_em).length;
  const atrasadas = tarefas.filter((x) => !x.concluida_em && (fimDe(x) ?? '9999') < hojeISO).length;
  const semEvidencia = tarefas.filter((x) => x.concluida_em && !evid[x.id]).length;

  const mover = (tarefa: TarefaSemana, dia: string) => {
    const fim = fimDe(tarefa); if (!fim || fim === dia) return;
    const novo = aplicarArrasto(tarefa, diferencaDias(fim, dia), 'mover'); if (!novo) return;
    const antes = qc.getQueryData<TarefaSemana[]>(key);
    void undoableAction({
      message: t('evidSemana.prazoMovido', { dia: new Date(`${dia}T12:00:00`).toLocaleDateString(intlLocale(), { weekday: 'long', day: '2-digit', month: '2-digit' }) }),
      undoLabel: t('evidSemana.desfazer'), durationMs: 4000,
      onHide: () => qc.setQueryData<TarefaSemana[]>(key, (old) => (old ?? []).map((x) => (x.id === tarefa.id ? { ...x, ...novo, prazo: novo.data_fim } : x))),
      onRestore: () => { qc.setQueryData<TarefaSemana[] | undefined>(key, antes); },
      onCommit: async () => {
        const { error } = await supabase.from('projeto_tarefas' as any).update({ ...novo, prazo: novo.data_fim } as any).eq('id', tarefa.id).eq('projeto_id', tarefa.projeto_id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['projeto-tarefas', tarefa.projeto_id] });
      },
    }).catch(() => { qc.setQueryData<TarefaSemana[] | undefined>(key, antes); toast.error(t('evidSemana.erroMover')); });
  };

  const Cartao = ({ x }: { x: TarefaSemana }) => (
    <button type="button" draggable={!x.concluida_em}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)}
      onClick={() => navigate(`/projetos/${x.projeto_id}?focus=${x.id}`)}
      className={cn('w-full rounded-md border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/50', x.concluida_em && 'opacity-60')}>
      <span className={cn('block text-sm font-medium leading-snug text-foreground', x.concluida_em && 'line-through')}>{x.titulo}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{x.projetos?.nome}</span>
      {x.concluida_em && !evid[x.id] && <span className="mt-1 block"><StatusBadge tone="warning">{t('evidSemana.semEvidencia')}</StatusBadge></span>}
      {!x.concluida_em && (fimDe(x) ?? '9999') < hojeISO && <span className="mt-1 block"><StatusBadge tone="destructive">{t('evidSemana.atrasada')}</StatusBadge></span>}
    </button>
  );

  if (isLoading) return <div className="flex justify-center py-16"><AkurisPulse /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSegunda(somarDias(segunda, -7))} aria-label={t('evidSemana.semanaAnterior')}>‹</Button>
          <Button variant="outline" size="sm" onClick={() => setSegunda(segundaDaSemana(hojeISO))}>{t('evidSemana.estaSemana')}</Button>
          <Button variant="outline" size="sm" onClick={() => setSegunda(somarDias(segunda, 7))} aria-label={t('evidSemana.proximaSemana')}>›</Button>
          <span className="ml-2 text-sm font-medium text-foreground">
            {new Date(`${dias[0]}T12:00:00`).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' })} – {new Date(`${dias[6]}T12:00:00`).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t('evidSemana.resumoMinhaSemana', { c: aConcluir, a: atrasadas, e: semEvidencia })}</p>
      </div>

      {andamento.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('evidSemana.emAndamento')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{andamento.map((x) => <Cartao key={x.id} x={x} />)}</div>
        </div>
      )}

      <div className="grid gap-2 overflow-x-auto md:grid-cols-7">
        {dias.map((d) => (
          <div key={d}
            onDragOver={(e) => { e.preventDefault(); setSobre(d); }} onDragLeave={() => setSobre(null)}
            onDrop={(e) => { e.preventDefault(); setSobre(null); const x = tarefas.find((y) => y.id === e.dataTransfer.getData('text/plain')); if (x) mover(x, d); }}
            className={cn('min-h-[180px] rounded-lg border p-2 transition-colors', d === hojeISO ? 'border-primary/50' : 'border-border', sobre === d && 'bg-primary/5')}>
            <p className={cn('mb-2 text-xs font-medium capitalize', d === hojeISO ? 'text-primary' : 'text-muted-foreground')}>
              {new Date(`${d}T12:00:00`).toLocaleDateString(intlLocale(), { weekday: 'short', day: '2-digit' })}
            </p>
            <div className="space-y-2">{(porDia[d] ?? []).map((x) => <Cartao key={x.id} x={x} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
