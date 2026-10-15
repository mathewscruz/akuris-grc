/**
 * RecordDetailDrawer — ficha lateral genérica de registo.
 *
 * Cabeçalho (ícone, eyebrow · código, título, chips, anterior/próximo, ações),
 * faixa de indicadores, alerta contextual e abas Visão geral · Ligações ·
 * Atividade. Todas as props novas são opcionais: quem só passa `fields`
 * continua a funcionar.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconArrowUpRight, IconChevronLeft, IconWarning } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

export interface DetailField {
  label: string;
  /** Valor já formatado (string) ou nó React (chip, badge, link). */
  value?: React.ReactNode;
  /** Ocupa a largura toda (descrições, observações). */
  full?: boolean;
}

export interface DetailSection {
  title: string;
  fields: DetailField[];
}

export interface DetailKpi {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}

export interface DetailAlert {
  tone: 'warning' | 'danger' | 'info';
  title: string;
  body?: React.ReactNode;
}

export interface DetailLinkItem {
  id: string;
  label: string;
  meta?: React.ReactNode;
  href?: string;
}

export interface DetailLinkGroup {
  title: string;
  items: DetailLinkItem[];
  emptyText?: string;
}

export interface DetailTimelineItem {
  date: string;
  title: string;
  detail?: React.ReactNode;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string | null;
  eyebrow?: string | null;
  /** Código lógico do registo (ex.: CT-2026-001). */
  code?: string | null;
  subtitle?: string | null;
  icon?: React.ElementType;
  badges?: React.ReactNode;
  /** Campos soltos (formato antigo). Usados quando não há `sections`. */
  fields?: DetailField[];
  /** Campos agrupados por secção. */
  sections?: DetailSection[];
  kpis?: DetailKpi[];
  alert?: DetailAlert | null;
  links?: DetailLinkGroup[];
  linksLoading?: boolean;
  timeline?: DetailTimelineItem[];
  actions?: React.ReactNode;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  children?: React.ReactNode;
}

const isEmpty = (v: React.ReactNode) => v === null || v === undefined || v === '' || v === '-';

const kpiTone: Record<NonNullable<DetailKpi['tone']>, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

const alertTone: Record<DetailAlert['tone'], string> = {
  info: 'border-l-primary bg-primary/[0.05]',
  warning: 'border-l-warning bg-warning/[0.07]',
  danger: 'border-l-destructive bg-destructive/[0.07]',
};

function FieldGrid({ fields, emptyText }: { fields: DetailField[]; emptyText: string }) {
  const visible = fields.filter((f) => !isEmpty(f.value));
  if (visible.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2">
      {visible.map((f, i) => (
        <div
          key={`${f.label}-${i}`}
          className={cn('border-b border-border/60 px-4 py-3.5 last:border-b-0', f.full ? 'sm:col-span-2' : 'sm:border-r sm:even:border-r-0')}
        >
          <dt className="mb-1.5 text-micro font-medium text-muted-foreground">{f.label}</dt>
          <dd className="break-words text-sm font-medium leading-relaxed text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-popover shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between border-b border-border/70 bg-surface-1/70 px-4 py-3">
        <h3 className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function RecordDetailDrawer({
  open, onOpenChange, title, eyebrow, code, subtitle, icon: Icon, badges,
  fields = [], sections, kpis, alert, links, linksLoading, timeline,
  actions, onPrev, onNext, createdBy, createdAt, updatedAt, children,
}: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('visao');
  useEffect(() => { if (open) setTab('visao'); }, [open, title]);

  const groups: DetailSection[] = sections?.length ? sections : [{ title: t('detalheRegisto.visao'), fields }];
  const linkCount = (links || []).reduce((n, g) => n + g.items.length, 0);

  const events: DetailTimelineItem[] = [
    ...(timeline || []),
    ...(updatedAt && updatedAt !== createdAt ? [{ date: updatedAt, title: t('detalheRegisto.eventoAtualizado') }] : []),
    ...(createdAt ? [{ date: createdAt, title: t('detalheRegisto.eventoCriado'), detail: createdBy || undefined }] : []),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const eyebrowText = [eyebrow, code].filter(Boolean).join(' · ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col bg-surface-1 p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-0 border-b border-border/70 bg-popover px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3 pr-10">
            {Icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrowText && (
                <p className="mb-1 truncate text-micro font-semibold uppercase tracking-[0.11em] text-muted-foreground">{eyebrowText}</p>
              )}
              <SheetTitle className="text-xl leading-tight">{title || t('detalheRegisto.titulo')}</SheetTitle>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {(onPrev || onNext) && (
              <div className="flex shrink-0 gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={!onPrev} onClick={() => onPrev?.()} aria-label={t('detalheRegisto.anterior')}>
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={!onNext} onClick={() => onNext?.()} aria-label={t('detalheRegisto.proximo')}>
                  <IconChevronLeft className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            )}
          </div>
          {badges && <div className={cn('flex flex-wrap items-center gap-2 pt-3', Icon && 'sm:pl-14')}>{badges}</div>}
          {actions && (
            <div className="mt-4 border-t border-border/60 pt-4 [&>div]:flex [&>div]:w-full [&>div]:flex-wrap [&>div]:gap-2">{actions}</div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {kpis && kpis.length > 0 && (
              <div className={cn('grid gap-px overflow-hidden rounded-lg border border-border/80 bg-border/60', kpis.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {kpis.map((k) => (
                  <div key={k.label} className="bg-popover px-3.5 py-3">
                    <p className="text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">{k.label}</p>
                    <p className={cn('mt-1 text-lg font-semibold tabular-nums leading-tight', kpiTone[k.tone || 'neutral'])}>{k.value}</p>
                    {k.hint && <p className="mt-0.5 text-micro text-muted-foreground">{k.hint}</p>}
                  </div>
                ))}
              </div>
            )}

            {alert && (
              <div role="status" className={cn('flex gap-3 rounded-lg border border-border/70 border-l-[3px] px-4 py-3', alertTone[alert.tone])}>
                <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                  {alert.body && <p className="mt-0.5 text-sm text-muted-foreground">{alert.body}</p>}
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="visao">{t('detalheRegisto.visao')}</TabsTrigger>
                {links && (
                  <TabsTrigger value="ligacoes">
                    {t('detalheRegisto.ligacoes')}
                    {linkCount > 0 && <span className="ml-1.5 text-micro tabular-nums text-muted-foreground">{linkCount}</span>}
                  </TabsTrigger>
                )}
                <TabsTrigger value="atividade">{t('detalheRegisto.atividade')}</TabsTrigger>
              </TabsList>

              <TabsContent value="visao" className="mt-4 space-y-4">
                {groups.map((g) => (
                  <Panel key={g.title} title={g.title}>
                    <FieldGrid fields={g.fields} emptyText={t('detalheRegisto.semCampos')} />
                  </Panel>
                ))}
                {children}
              </TabsContent>

              {links && (
                <TabsContent value="ligacoes" className="mt-4 space-y-4">
                  {linksLoading ? (
                    <div className="flex justify-center py-10"><AkurisPulse size={28} /></div>
                  ) : links.map((g) => (
                    <Panel key={g.title} title={g.title} right={<span className="text-micro tabular-nums text-muted-foreground">{g.items.length}</span>}>
                      {g.items.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">{g.emptyText || t('detalheRegisto.semLigacoes')}</p>
                      ) : (
                        <ul className="divide-y divide-border/60">
                          {g.items.map((it) => {
                            const inner = (
                              <>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-foreground">{it.label}</span>
                                  {it.meta && <span className="mt-0.5 block text-micro text-muted-foreground">{it.meta}</span>}
                                </span>
                                {it.href && <IconArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              </>
                            );
                            return (
                              <li key={it.id}>
                                {it.href ? (
                                  <Link to={it.href} onClick={() => onOpenChange(false)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-1">{inner}</Link>
                                ) : (
                                  <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Panel>
                  ))}
                </TabsContent>
              )}

              <TabsContent value="atividade" className="mt-4">
                <Panel title={t('detalheRegisto.atividade')}>
                  {events.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">{t('detalheRegisto.semAtividade')}</p>
                  ) : (
                    <ol className="relative space-y-4 px-4 py-4">
                      {events.map((e, i) => (
                        <li key={`${e.date}-${i}`} className="relative pl-6">
                          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                          {i < events.length - 1 && <span className="absolute left-[3px] top-4 h-[calc(100%+0.5rem)] w-px bg-border" />}
                          <p className="text-sm font-medium text-foreground">{e.title}</p>
                          <p className="text-micro text-muted-foreground">
                            {formatDateOnly(e.date)}{e.detail ? <> · {e.detail}</> : null}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
