import React from 'react';
import { IconChevron, IconChevronLeft } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ProjetoTarefa, ProjetoTarefaPrioridade } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPrioridadeLabel } from '@/components/projetos/enum-labels';
import { formatarDiaParaDB, intlLocale, parseDataLocal } from '@/lib/date-utils';
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
      // Componentes LOCAIS nos dois lados. Com `toISOString()` a célula
      // (meia-noite local) e a tarefa (meio-dia local) caem em dias
      // diferentes a partir de UTC+1 — e o calendário ficava vazio para
      // qualquer utilizador a leste de Greenwich, Portugal incluído no
      // horário de verão. No Brasil funcionava por acaso.
      const key = formatarDiaParaDB(parseDataLocal(t.prazo));
      (m[key] ??= []).push(t);
    });
    return m;
  }, [tarefas]);

  const WEEK = [
    t('projetos.calendar.weekdaySun'), t('projetos.calendar.weekdayMon'), t('projetos.calendar.weekdayTue'),
    t('projetos.calendar.weekdayWed'), t('projetos.calendar.weekdayThu'), t('projetos.calendar.weekdayFri'), t('projetos.calendar.weekdaySat'),
  ];

  const monthLabel = cursor.toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold capitalize">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(new Date(ano, mes - 1, 1))}>
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
            {t('projetos.calendar.today')}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(new Date(ano, mes + 1, 1))}>
            <IconChevron className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <div className="grid grid-cols-7 text-xs text-muted-foreground bg-muted/30 min-w-[560px]">
        {WEEK.map((d) => <div key={d} className="px-2 py-1.5 font-medium">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border min-w-[560px]">
        {grid.map((d, i) => {
          const key = d ? formatarDiaParaDB(d) : `empty-${i}`;
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
                      className="w-full text-left text-micro leading-tight px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 truncate"
                      onClick={() => onSelectTarefa(tarefaItem)}
                      title={`${prioridadeLabel} · ${tarefaItem.titulo}`}
                    >
                      <StatusBadge tone={prioridadeTone[tarefaItem.prioridade]}>{prioridadeLabel[0].toUpperCase()}</StatusBadge>{' '}
                      {tarefaItem.titulo}
                    </button>
                  );
                })}
                {items.length > 3 && <div className="text-micro text-muted-foreground px-1.5">{t('projetos.calendar.more', { count: items.length - 3 })}</div>}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
