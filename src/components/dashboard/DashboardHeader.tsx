import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconTime, IconRefresh } from '@/components/icons';
;
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/icons/Icon';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { dateFnsLocale } from '@/lib/date-utils';

interface DashboardHeaderProps {
  /** Mantido por compatibilidade — não é mais exibido. */
  userName?: string;
  /** Mantido por compatibilidade — não é mais exibido (info já no Hero). */
  criticalCount?: number;
  dataUpdatedAt?: number;
  onRefresh: () => void;
}

/** Trava de segurança: sem ela um refresh que falha deixaria "Atualizando…" preso. */
const TIMEOUT_ATUALIZANDO_MS = 8000;
/** Quanto tempo o "Atualizado" permanece antes de voltar ao estado neutro. */
const DURACAO_ATUALIZADO_MS = 2500;

/**
 * Header do Dashboard: título "Dashboard" + ações (refresh, modo foco, timestamp).
 * Sumário contextual foi removido — informação crítica já é exposta pelo
 * Hero Score Banner e KPI Pills logo abaixo.
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  dataUpdatedAt,
  onRefresh,
}) => {
  const { t, locale } = useLanguage();
  const dateLocale = dateFnsLocale();
  const navigate = useNavigate();

  const timeStr = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm', { locale: dateLocale }) : '--:--';

  // AKURIS QA-016: feedback do refresh. O estado "atualizando" só termina
  // quando os indicadores voltam com um timestamp novo — nada de tempo fixo
  // fingindo conclusão.
  const [atualizando, setAtualizando] = React.useState(false);
  const [concluido, setConcluido] = React.useState(false);
  const timestampNoClique = React.useRef<number | undefined>(undefined);

  const handleRefresh = () => {
    timestampNoClique.current = dataUpdatedAt;
    setConcluido(false);
    setAtualizando(true);
    onRefresh();
  };

  React.useEffect(() => {
    if (!atualizando) return;

    if (dataUpdatedAt !== undefined && dataUpdatedAt !== timestampNoClique.current) {
      setAtualizando(false);
      setConcluido(true);
      return;
    }

    const id = setTimeout(() => setAtualizando(false), TIMEOUT_ATUALIZANDO_MS);
    return () => clearTimeout(id);
  }, [atualizando, dataUpdatedAt]);

  React.useEffect(() => {
    if (!concluido) return;
    const id = setTimeout(() => setConcluido(false), DURACAO_ATUALIZADO_MS);
    return () => clearTimeout(id);
  }, [concluido]);

  const statusLabel = atualizando
    ? t('dashboard_v3.refreshing')
    : concluido
      ? t('dashboard_v3.refreshed')
      : null;

  const refreshLabel = t('dashboard_v3.refresh');

  return (
    // AKURIS QA-016: linha única também no mobile — `flex-col` empilhava o
    // ícone numa linha própria, solto e sem relação visível com o título.
    <div className="flex flex-row items-center justify-between gap-3">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
        Dashboard
      </h1>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Icon as={IconTime} size="xs" />
          <span className="tabular-nums">{t('dashboard_v3.updatedAt').replace('{{time}}', timeStr)}</span>
        </div>

        {/*
          Contexto textual do refresh, visível também no mobile enquanto dura.
          `aria-hidden` porque a região viva abaixo já anuncia o mesmo texto.
        */}
        {statusLabel && (
          <span aria-hidden="true" className="text-xs text-muted-foreground whitespace-nowrap">
            {statusLabel}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              aria-label={refreshLabel}
            >
              <Icon as={IconRefresh} size="sm" className={atualizando ? 'animate-spin' : undefined} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{statusLabel ?? refreshLabel}</TooltipContent>
        </Tooltip>

        {/*
          A acção primária da página.

          O painel não tinha nenhuma: era a única superfície do produto onde o
          canto superior direito estava vazio. Levar daqui um relatório é o que
          se faz depois de olhar para estes números — e é a acção que o resto
          do produto não oferece a partir de mais lado nenhum.
        */}
        <Button size="sm" className="h-8" onClick={() => navigate('/relatorios')}>
          {t('dashboard_v3.executiveReport')}
        </Button>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {statusLabel ?? ''}
      </span>
    </div>
  );
};


