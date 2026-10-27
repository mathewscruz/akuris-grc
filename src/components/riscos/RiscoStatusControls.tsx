import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { resolveRiscoStatusTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAlterarStatusRisco } from '@/hooks/useAlterarStatusRisco';
import { FLUXO_STATUS_RISCO, proximoStatusRisco } from '@/components/riscos/risk-status';
import { IconArrowRight, IconChevron } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Pílula de status clicável (tabela): escolher salva na hora. */
export function RiscoStatusMenu({ riscoId, status, title }: { riscoId: string; status: string; title?: string }) {
  const { t } = useLanguage();
  const { alterar, salvando } = useAlterarStatusRisco();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title={title}
          disabled={salvando === riscoId}
          aria-label={t('riscos.page.move.changeTo')}
          className="inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatusBadge {...resolveRiscoStatusTone(status)}>{formatStatus(status)}</StatusBadge>
          <IconChevron className="h-3 w-3 text-muted-foreground rotate-90" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">{t('riscos.page.move.changeTo')}</DropdownMenuLabel>
        {FLUXO_STATUS_RISCO.map((s) => (
          <DropdownMenuItem key={s} disabled={s === status} onSelect={() => alterar(riscoId, s, status)}>
            {t(`riscos.page.status.${s}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Trilha de status (painel lateral): clicar num passo muda o status. */
export function RiscoStatusStepper({ riscoId, status }: { riscoId: string; status: string }) {
  const { t } = useLanguage();
  const { alterar, salvando } = useAlterarStatusRisco();
  const atualIdx = FLUXO_STATUS_RISCO.indexOf(status as never);
  const proximo = proximoStatusRisco(status);
  const busy = salvando === riscoId;
  return (
    <div className="space-y-2" aria-label={t('riscos.page.move.label')}>
      <ol className="flex items-center gap-1 flex-wrap">
        {FLUXO_STATUS_RISCO.map((s, i) => {
          const ativo = i === atualIdx;
          const feito = atualIdx >= 0 && i < atualIdx;
          return (
            <li key={s} className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy || ativo}
                onClick={() => alterar(riscoId, s, status)}
                aria-current={ativo ? 'step' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-full border px-2.5 h-7 text-xs transition-colors',
                  ativo && 'border-primary bg-primary/10 text-primary font-medium',
                  feito && !ativo && 'border-border text-foreground',
                  !feito && !ativo && 'border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
                )}
              >
                {t(`riscos.page.status.${s}`)}
              </button>
              {i < FLUXO_STATUS_RISCO.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>
      {proximo && (
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => alterar(riscoId, proximo, status)}>
          {t('riscos.page.move.advance', { status: t(`riscos.page.status.${proximo}`) })}
          <IconArrowRight className="h-3.5 w-3.5 ml-1" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
