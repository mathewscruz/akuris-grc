import React from 'react';
import { IconChevron, IconChevronLeft } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';
import { isMarco, estaAtrasada } from '@/lib/projeto-acompanhamento';
import { statusKindDe, type StatusKind } from './StatusPill';
import { partirTitulo, mapaFilhos } from './projeto-visual';

const CHIP: Record<StatusKind, string> = {
  rest: 'bg-muted text-foreground/80 border-l-muted-foreground/50',
  active: 'bg-state-active-surface text-state-active border-l-state-active',
  done: 'bg-state-done-surface text-state-done border-l-state-done',
  late: 'bg-destructive/10 text-destructive border-l-destructive',
};
const DAY = 86_400_000;
const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function CalendarView({ tarefas, colunas = [], onSelectTarefa }: { tarefas: ProjetoTarefa[]; colunas?: ProjetoColuna[]; onSelectTarefa: (t: ProjetoTarefa) => void }) {
  const { t } = useLanguage();
  const [modo, setModo] = React.useState<'mes' | 'semana'>('mes');
  const [cursor, setCursor] = React.useState(() => new Date());

  const filhos = React.useMemo(() => mapaFilhos(tarefas), [tarefas]);
  const itens = React.useMemo(() => tarefas
    .filter((x) => !filhos.has(x.id))
    .map((x) => {
      const fimS = x.data_fim ?? x.prazo;
      const iniS = x.data_inicio ?? fimS;
      if (!iniS || !fimS) return null;
      const ini = meiaNoite(parseDataLocal(iniS));
      const fim = Math.max(ini, meiaNoite(parseDataLocal(fimS)));
      const kind: StatusKind = x.concluida_em ? 'done' : estaAtrasada(x) ? 'late' : statusKindDe(colunas.find((c) => c.id === x.coluna_id));
      return { t: x, ini, fim, kind };
    })
    .filter(Boolean) as { t: ProjetoTarefa; ini: number; fim: number; kind: StatusKind }[], [tarefas, filhos, colunas]);

  // Grelha: mês completo (semanas de domingo a sábado) ou uma semana.
  const dias: Date[] = [];
  if (modo === 'mes') {
    const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const inicio = new Date(primeiro); inicio.setDate(1 - primeiro.getDay());
    const ultimo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const total = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7) * 7;
    for (let i = 0; i < total; i++) dias.push(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  } else {
    const inicio = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay());
    for (let i = 0; i < 7; i++) dias.push(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  }
  const mover = (dir: number) => setCursor((c) => modo === 'mes' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir * 7));
  const limite = modo === 'mes' ? 3 : 12;
  const hoje = meiaNoite(new Date());

  const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => t(`projetos.calendar.weekday${d}`));
  const titulo = modo === 'mes'
    ? cursor.toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' })
    : `${dias[0].toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' })} – ${dias[6].toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const Chip = ({ it, dia }: { it: (typeof itens)[number]; dia: number }) => {
    const { codigo, nome } = partirTitulo(it.t.titulo);
    const inicioSeg = it.ini === dia || new Date(dia).getDay() === 0;
    const fimSeg = it.fim === dia || new Date(dia).getDay() === 6;
    return (
      <button type="button" onClick={() => onSelectTarefa(it.t)} title={it.t.titulo}
        className={`flex h-5 w-full items-center gap-1 truncate px-1.5 text-[11px] font-medium leading-none transition-opacity hover:opacity-80 ${CHIP[it.kind]} ${inicioSeg ? 'rounded-l border-l-2' : '-ml-1.5 pl-3'} ${fimSeg ? 'rounded-r' : '-mr-1.5'}`}>
        {inicioSeg && <>
          {isMarco(it.t) && <span className="text-[hsl(var(--fw-gold))]">◆</span>}
          {codigo && <span className="tabular-nums opacity-80">{codigo}</span>}
          <span className="truncate">{nome}</span>
        </>}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(-1)} aria-label={t('common.previous')} title={t('common.previous')}><IconChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mover(1)} aria-label={t('common.next')} title={t('common.next')}><IconChevron className="h-4 w-4" /></Button>
          <h3 className="ml-1 text-sm font-semibold capitalize">{titulo}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>{t('projetos.calendar.today')}</Button>
          <div className="flex rounded-md bg-muted p-0.5">
            {(['mes', 'semana'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={`h-7 rounded px-3 text-xs font-medium ${modo === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{t(`p3Projetos.calendario.${m}`)}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 border-b border-border bg-muted/30 text-micro font-medium uppercase tracking-wide text-muted-foreground/75">
          {WEEK.map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
        </div>
        <div className="grid min-w-[640px] grid-cols-7">
          {dias.map((d) => {
            const dia = d.getTime();
            const doDia = itens.filter((i) => i.ini <= dia && i.fim >= dia).sort((a, b) => a.ini - b.ini || a.fim - b.fim);
            const foraMes = modo === 'mes' && d.getMonth() !== cursor.getMonth();
            const fds = d.getDay() === 0 || d.getDay() === 6;
            const ehHoje = dia === hoje;
            return (
              <div key={dia} className={`flex flex-col gap-1 border-b border-r border-border/60 p-1.5 ${modo === 'mes' ? 'min-h-[112px]' : 'min-h-[360px]'} ${fds ? 'bg-muted/25' : ''} ${foraMes ? 'opacity-45' : ''}`}>
                <div className="flex justify-end">
                  <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${ehHoje ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                </div>
                {doDia.slice(0, limite).map((it) => <Chip key={it.t.id} it={it} dia={dia} />)}
                {doDia.length > limite && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-primary">
                        {t('projetos.calendar.more', { count: doDia.length - limite })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 space-y-1 p-2" align="start">
                      <p className="px-1 pb-1 text-xs font-semibold capitalize">{d.toLocaleDateString(intlLocale(), { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                      {doDia.map((it) => { const p = partirTitulo(it.t.titulo); return (
                        <button key={it.t.id} type="button" onClick={() => onSelectTarefa(it.t)}
                          className={`flex w-full items-center gap-1.5 truncate rounded border-l-2 px-2 py-1 text-left text-xs ${CHIP[it.kind]}`}>
                          {p.codigo && <span className="tabular-nums opacity-80">{p.codigo}</span>}<span className="truncate">{p.nome}</span>
                        </button>
                      ); })}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
