import { rowOpenProps, CARD_HOVER } from '@/lib/row-interaction';
import { IconEdit, IconDelete, IconMore, IconCalendar, IconFile, IconPerson, IconChecklist } from '@/components/icons';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveAuditoriaStatusTone, resolveAuditoriaPrioridadeTone } from "@/lib/status-tone";
import { formatDateOnly } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuditoriaCardAccordionProps {
  auditoria: any;
  counts: { itens: number; itensConcluidos: number };
  onEdit: () => void;
  onDelete: () => void;
  onOpenControles: () => void;
  auditorNome?: string;
}

export function AuditoriaCardAccordion({
  auditoria,
  counts,
  onEdit,
  onDelete,
  onOpenControles,
  auditorNome
}: AuditoriaCardAccordionProps) {
  const { t } = useLanguage();
  const progressPercent = counts.itens > 0 ? Math.round((counts.itensConcluidos / counts.itens) * 100) : 0;

  return (
    <Card
      {...(() => {
        const props = rowOpenProps(onOpenControles, auditoria.nome, CARD_HOVER);
        return { ...props, className: `transition-shadow ${props.className}` };
      })()}
    >
      <CardContent className="p-3">
        {/* Linha principal */}
        <div className="flex items-start justify-between gap-3">
          {/* Nome */}
          <div className="flex items-start gap-2 min-w-0 flex-shrink-0" style={{ width: '220px' }}>
            <IconFile className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="font-medium text-sm line-clamp-2 break-words">{auditoria.nome}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            <StatusBadge tone="neutral" variant="outline" className="whitespace-nowrap">
              {formatStatus(auditoria.tipo)}
            </StatusBadge>
            <StatusBadge {...resolveAuditoriaStatusTone(auditoria.status)}>
              {formatStatus(auditoria.status)}
            </StatusBadge>
            {auditoria.conclusao_forcada && (
              <span title={auditoria.conclusao_justificativa || undefined}>
                <StatusBadge tone="warning">
                  {t('t4.gates.forcadaCurta')}
                </StatusBadge>
              </span>
            )}
            <StatusBadge {...resolveAuditoriaPrioridadeTone(auditoria.prioridade)}>
              {formatStatus(auditoria.prioridade)}
            </StatusBadge>
            
            {/* Botão Itens com progresso */}
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenControles}
              className="h-6 px-2 text-micro gap-1.5"
            >
              <IconChecklist className="h-3 w-3" />
              <span>{t('controlesAuditorias.acaItens')}</span>
              <StatusBadge tone="neutral" className="ml-1">
                {counts.itensConcluidos}/{counts.itens}
              </StatusBadge>
            </Button>

            {/* Barra de progresso compacta */}
            {counts.itens > 0 && (
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <Progress value={progressPercent} className="h-1.5 flex-1" />
                <span className="text-micro text-muted-foreground">{progressPercent}%</span>
              </div>
            )}

            {/* Data e Auditor */}
            {auditoria.data_inicio && (
              <StatusBadge tone="neutral" variant="outline" icon={<IconCalendar className="h-3 w-3" />}>
                {formatDateOnly(auditoria.data_inicio)}
              </StatusBadge>
            )}
            {auditorNome && (
              <StatusBadge tone="neutral" variant="outline" icon={<IconPerson className="h-3 w-3" />}>
                <span className="max-w-[100px] truncate">{auditorNome}</span>
              </StatusBadge>
            )}
          </div>

          {/* Menu de ações */}
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <IconMore className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <IconEdit className="h-4 w-4 mr-2" />
                  {t('controlesAuditorias.acaEditar')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenControles}>
                  <IconChecklist className="h-4 w-4 mr-2" />
                  {t('controlesAuditorias.acaGerenciarItens')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <IconDelete className="h-4 w-4 mr-2" />
                  {t('controlesAuditorias.acaExcluir')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Descrição se houver */}
        {auditoria.descricao && (
          <p className="text-micro text-muted-foreground mt-2 line-clamp-1">
            {auditoria.descricao}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
