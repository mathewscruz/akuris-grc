import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Edit, 
  Trash2,
  Calendar,
  User,
  ClipboardList,
  MoreHorizontal
} from "lucide-react";
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
  const progressPercent = counts.itens > 0 ? Math.round((counts.itensConcluidos / counts.itens) * 100) : 0;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-3">
        {/* Linha principal */}
        <div className="flex items-center justify-between gap-3">
          {/* Nome */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0" style={{ width: '200px' }}>
            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm truncate">{auditoria.nome}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            <StatusBadge size="sm" tone="neutral" variant="outline" className="whitespace-nowrap">
              {formatStatus(auditoria.tipo)}
            </StatusBadge>
            <StatusBadge size="sm" {...resolveAuditoriaStatusTone(auditoria.status)}>
              {formatStatus(auditoria.status)}
            </StatusBadge>
            <StatusBadge size="sm" {...resolveAuditoriaPrioridadeTone(auditoria.prioridade)}>
              {formatStatus(auditoria.prioridade)}
            </StatusBadge>
            
            {/* Botão Itens com progresso */}
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenControles}
              className="h-6 px-2 text-[11px] gap-1.5"
            >
              <ClipboardList className="h-3 w-3" />
              <span>Itens</span>
              <StatusBadge size="sm" tone="neutral" className="ml-1">
                {counts.itensConcluidos}/{counts.itens}
              </StatusBadge>
            </Button>

            {/* Barra de progresso compacta */}
            {counts.itens > 0 && (
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <Progress value={progressPercent} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground">{progressPercent}%</span>
              </div>
            )}

            {/* Data e Auditor */}
            {auditoria.data_inicio && (
              <StatusBadge size="sm" tone="neutral" variant="outline" icon={<Calendar className="h-3 w-3" />}>
                {formatDateOnly(auditoria.data_inicio)}
              </StatusBadge>
            )}
            {auditorNome && (
              <StatusBadge size="sm" tone="neutral" variant="outline" icon={<User className="h-3 w-3" />}>
                <span className="max-w-[100px] truncate">{auditorNome}</span>
              </StatusBadge>
            )}
          </div>

          {/* Menu de ações */}
          <div className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenControles}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Gerenciar Itens
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Descrição se houver */}
        {auditoria.descricao && (
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1">
            {auditoria.descricao}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
