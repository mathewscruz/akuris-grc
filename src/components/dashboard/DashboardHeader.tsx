import * as React from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/icons/Icon';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface DashboardHeaderProps {
  /** Mantido por compatibilidade — não é mais exibido. */
  userName?: string;
  /** Mantido por compatibilidade — não é mais exibido (info já no Hero). */
  criticalCount?: number;
  dataUpdatedAt?: number;
  onRefresh: () => void;
}

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
  const dateLocale = locale === 'pt' ? ptBR : enUS;

  const timeStr = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm', { locale: dateLocale }) : '--:--';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
        Dashboard
      </h1>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Icon as={Clock} size="xs" />
          <span className="tabular-nums">{t('dashboard_v3.updatedAt').replace('{{time}}', timeStr)}</span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} aria-label="Refresh">
              <Icon as={RefreshCw} size="sm" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{timeStr}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;

