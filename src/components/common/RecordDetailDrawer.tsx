/**
 * RecordDetailDrawer — painel lateral genérico de detalhe de registo.
 *
 * Serve os módulos que ainda não tinham vista de detalhe própria: mostra os
 * campos principais, quem criou e quando. Mantém o mesmo padrão visual do
 * painel de risco e de plano de ação (Sheet lateral, cabeçalho com título,
 * chips de estado e menu de ações secundárias).
 */
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string | null;
  /** Small label that identifies the kind of record before its title. */
  eyebrow?: string | null;
  subtitle?: string | null;
  /** Semantic module icon, used as a stable visual anchor. */
  icon?: React.ElementType;
  /** Chips de estado/severidade apresentados sob o título. */
  badges?: React.ReactNode;
  fields: DetailField[];
  /** Ações secundárias (editar, exportar) no rodapé do cabeçalho. */
  actions?: React.ReactNode;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Conteúdo adicional (abas já existentes noutros módulos). */
  children?: React.ReactNode;
}

const isEmpty = (v: React.ReactNode) =>
  v === null || v === undefined || v === '' || v === '-';

export function RecordDetailDrawer({
  open,
  onOpenChange,
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  badges,
  fields,
  actions,
  createdBy,
  createdAt,
  updatedAt,
  children,
}: Props) {
  const { t } = useLanguage();
  const visible = fields.filter((f) => !isEmpty(f.value));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col bg-surface-1 p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-0 border-b border-border/70 bg-popover px-5 pb-5 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start gap-3 pr-10">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="mb-1 text-micro font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                  {eyebrow}
                </p>
              )}
              <SheetTitle className="text-xl leading-tight">
                {title || t('detalheRegisto.titulo')}
              </SheetTitle>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {badges && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 pt-4',
                actions && 'pb-4',
                Icon && 'pl-[3.25rem]'
              )}
            >
              {badges}
            </div>
          )}
          {actions && (
            <div className="border-t border-border/60 pt-4 [&>div]:flex [&>div]:w-full [&>div]:flex-wrap [&>div]:gap-2">
              {actions}
            </div>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <section className="overflow-hidden rounded-lg border border-border/80 bg-popover shadow-sm">
              <h3 className="border-b border-border/70 bg-surface-1/70 px-4 py-3 text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t('detalheRegisto.visao')}
              </h3>
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t('detalheRegisto.semCampos')}</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2">
                  {visible.map((f, i) => (
                    <div
                      key={`${f.label}-${i}`}
                      className={cn(
                        'border-b border-border/60 px-4 py-3.5',
                        f.full ? 'sm:col-span-2' : 'sm:border-r sm:even:border-r-0'
                      )}
                    >
                      <dt className="mb-1.5 text-micro font-medium text-muted-foreground">{f.label}</dt>
                      <dd className="break-words text-sm font-medium leading-relaxed text-foreground">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {(createdBy || createdAt || updatedAt) && (
              <section className="rounded-lg border border-border/70 bg-popover px-4 py-3.5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {createdBy && (
                    <div>
                      <dt className="mb-1 text-micro text-muted-foreground">{t('detalheRegisto.criadoPor')}</dt>
                      <dd className="text-sm text-foreground">{createdBy}</dd>
                    </div>
                  )}
                  {createdAt && (
                    <div>
                      <dt className="mb-1 text-micro text-muted-foreground">{t('detalheRegisto.criadoEm')}</dt>
                      <dd className="text-sm text-foreground">{formatDateOnly(createdAt)}</dd>
                    </div>
                  )}
                  {updatedAt && (
                    <div>
                      <dt className="mb-1 text-micro text-muted-foreground">{t('detalheRegisto.atualizadoEm')}</dt>
                      <dd className="text-sm text-foreground">{formatDateOnly(updatedAt)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
