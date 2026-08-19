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
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

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
  subtitle?: string | null;
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
  subtitle,
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
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 space-y-2 text-left">
          <SheetTitle className="text-xl leading-tight pr-8">
            {title || t('detalheRegisto.titulo')}
          </SheetTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {badges && <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div>}
          {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
        </SheetHeader>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            <section>
              <h3 className="text-xs font-medium text-muted-foreground mb-3">
                {t('detalheRegisto.visao')}
              </h3>
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detalheRegisto.semCampos')}</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {visible.map((f, i) => (
                    <div key={`${f.label}-${i}`} className={f.full ? 'sm:col-span-2' : undefined}>
                      <dt className="text-xs text-muted-foreground mb-1">{f.label}</dt>
                      <dd className="text-sm text-foreground break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {(createdBy || createdAt || updatedAt) && (
              <>
                <Separator />
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {createdBy && (
                    <div>
                      <dt className="text-xs text-muted-foreground mb-1">{t('detalheRegisto.criadoPor')}</dt>
                      <dd className="text-sm text-foreground">{createdBy}</dd>
                    </div>
                  )}
                  {createdAt && (
                    <div>
                      <dt className="text-xs text-muted-foreground mb-1">{t('detalheRegisto.criadoEm')}</dt>
                      <dd className="text-sm text-foreground">{formatDateOnly(createdAt)}</dd>
                    </div>
                  )}
                  {updatedAt && (
                    <div>
                      <dt className="text-xs text-muted-foreground mb-1">{t('detalheRegisto.atualizadoEm')}</dt>
                      <dd className="text-sm text-foreground">{formatDateOnly(updatedAt)}</dd>
                    </div>
                  )}
                </dl>
              </>
            )}

            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

