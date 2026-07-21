import { Plus, Pencil, Trash2, Wallet, CalendarClock, Circle, CircleDot, CheckCircle2, MoreHorizontal, ListChecks } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ProgramaItem, ProgramaFase, ItemStatus } from '@/hooks/usePrograma';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NIVEL_LABEL: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
const CYCLE: Record<ItemStatus, ItemStatus> = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' };

function diasPara(data: string | null): number | null {
  if (!data) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(data + 'T00:00:00').getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}
function Icon({ status }: { status: ItemStatus }) {
  if (status === 'concluido') return <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />;
  if (status === 'em_andamento') return <CircleDot className="h-5 w-5 text-primary" strokeWidth={1.5} />;
  return <Circle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  itens: ProgramaItem[];
  fase?: ProgramaFase | null;
  onToggleStatus: (id: string, status: ItemStatus) => void;
  onEdit: (item: ProgramaItem) => void;
  onDelete: (item: ProgramaItem) => void;
  onAdd?: () => void;
  onEditFase?: () => void;
}

export function ItensListDialog({ open, onOpenChange, title, subtitle, itens, fase, onToggleStatus, onEdit, onDelete, onAdd, onEditFase }: Props) {
  const custo = itens.reduce((s, i) => s + Number(i.custo_estimado || 0), 0);
  const done = itens.filter((i) => i.status === 'concluido').length;

  return (
    <DialogShell open={open} onOpenChange={onOpenChange} icon={ListChecks} title={title} description={subtitle} size="lg" hideFooter>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{done}/{itens.length} concluídos</span>
            <span>·</span>
            <span><Wallet className="h-3.5 w-3.5 inline mr-1" strokeWidth={1.5} />itens {fmtBRL(custo)}{fase?.orcamento != null ? <> de <span className={custo > Number(fase.orcamento) ? 'text-destructive' : ''}>{fmtBRL(Number(fase.orcamento))}</span></> : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {onEditFase && <Button size="sm" variant="ghost" onClick={onEditFase}><Pencil className="h-4 w-4 mr-1" /> Orçamento</Button>}
            {onAdd && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" /> Item</Button>}
          </div>
        </div>

        {itens.length === 0 ? (
          <EmptyState title="Sem itens aqui" description="Adicione itens do que precisa ser feito, com custo, prazo e ferramenta." />
        ) : (
          <div className="space-y-2">
            {itens.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <button onClick={() => onToggleStatus(it.id, CYCLE[it.status])} title="Alterar status" className="shrink-0"><Icon status={it.status} /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${it.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>{it.titulo}</span>
                    {it.requirement_id && <StatusBadge tone="info" size="sm" variant="outline">Gap Analysis</StatusBadge>}
                    {it.impacto && <StatusBadge tone={it.impacto === 'alto' ? 'warning' : 'neutral'} size="sm" variant="outline">Impacto {NIVEL_LABEL[it.impacto]}</StatusBadge>}
                    {it.esforco && <StatusBadge tone="neutral" size="sm" variant="outline">Esforço {NIVEL_LABEL[it.esforco]}</StatusBadge>}
                    {it.ferramenta_sugerida && <StatusBadge tone="neutral" size="sm">{it.ferramenta_sugerida}</StatusBadge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {it.custo_estimado != null && <span><Wallet className="h-3 w-3 inline mr-1" strokeWidth={1.5} />{fmtBRL(Number(it.custo_estimado))}</span>}
                    {it.prazo && <span className={diasPara(it.prazo)! < 0 && it.status !== 'concluido' ? 'text-destructive' : ''}><CalendarClock className="h-3 w-3 inline mr-1" strokeWidth={1.5} />{new Date(it.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(it)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(it)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
