import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPrioridadeLabel } from '@/components/projetos/enum-labels';

const prioridadeTone: Record<ProjetoTarefaPrioridade, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  critica: 'destructive', alta: 'warning', media: 'info', baixa: 'neutral',
};

export function CalendarView({ tarefas, onSelectTarefa }: { tarefas: ProjetoTarefa[]; onSelectTarefa: (t: ProjetoTarefa) => void }) {
  const { t } = useLanguage();
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();
  const firstDow = new Date(ano, mes, 1).getDay();
  const lastDate = new Date(ano, mes + 1, 0).getDate();

  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) grid.push(null);
  for (let d = 1; d <= lastDate; d++) grid.push(new Date(ano, mes, d));
  while (grid.length % 7 !== 0) grid.push(null);

  const porDia = React.useMemo(() => {
    const m: Record<string, ProjetoTarefa[]> = {};
    tarefas.forEach((t) => {
      if (!t.prazo) return;
      const key = new Date(t.prazo).toISOString().slice(0, 10);
      (m[key] ??= []).push(t);
    });
    return m;
  }, [tarefas]);

  const WEEK = [
    t('projetos.calendar.weekdaySun'), t('projetos.calendar.weekdayMon'), t('projetos.calendar.weekdayTue'),
    t('projetos.calendar.weekdayWed'), t('projetos.calendar.weekdayThu'), t('projetos.calendar.weekdayFri'), t('projetos.calendar.weekdaySat'),
  ];

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(new Date(ano, mes - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
            {t('projetos.calendar.today')}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(new Date(ano, mes + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-muted-foreground bg-muted/30 min-w-[560px]">
        {WEEK.map((d) => <div key={d} className="px-2 py-1.5 font-medium">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border min-w-[560px]">
        {grid.map((d, i) => {
          const key = d ? d.toISOString().slice(0, 10) : `empty-${i}`;
          const items = d ? (porDia[key] ?? []) : [];
          const isToday = d && d.toDateString() === new Date().toDateString();
          return (
            <div key={key} className={`min-h-[90px] bg-card p-1.5 ${!d ? 'opacity-40' : ''}`}>
              {d && (
                <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {d.getDate()}
                </div>
              )}
              <div className="space-y-1">
                {items.slice(0, 3).map((tarefaItem) => {
                  const prioridadeLabel = getPrioridadeLabel(t, tarefaItem.prioridade);
                  return (
                    <button
                      key={tarefaItem.id}
                      className="w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 truncate"
                      onClick={() => onSelectTarefa(tarefaItem)}
                      title={`${prioridadeLabel} · ${tarefaItem.titulo}`}
                    >
                      <StatusBadge tone={prioridadeTone[tarefaItem.prioridade]} size="sm">{prioridadeLabel[0].toUpperCase()}</StatusBadge>{' '}
                      {tarefaItem.titulo}
                    </button>
                  );
                })}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground px-1.5">{t('projetos.calendar.more', { count: items.length - 3 })}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
