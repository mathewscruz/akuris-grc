import { useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { FerramentaDialog } from '@/components/programa/FerramentaDialog';
import type { ProgramaFerramenta, ProgramaFase } from '@/hooks/usePrograma';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const REC_LABEL: Record<string, string> = { unica: 'única', mensal: '/mês', anual: '/ano' };
const TONE: Record<string, 'success' | 'warning' | 'neutral'> = { contratada: 'success', avaliando: 'warning', planejada: 'neutral' };
const LABEL: Record<string, string> = { contratada: 'Contratada', avaliando: 'Avaliando', planejada: 'Planejada' };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ferramentas: ProgramaFerramenta[];
  fases: ProgramaFase[];
  onSave: (values: Partial<ProgramaFerramenta> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function FerramentasListDialog({ open, onOpenChange, ferramentas, fases, onSave, onDelete }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramaFerramenta | null>(null);
  const [deleting, setDeleting] = useState<ProgramaFerramenta | null>(null);

  const total = ferramentas.reduce((s, f) => s + Number(f.custo || 0), 0);

  return (
    <>
      <DialogShell open={open} onOpenChange={onOpenChange} icon={Wrench} title="Ferramentas técnicas" description="O que você está ou vai contratar para se adequar." size="lg" hideFooter>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total estimado: <span className="text-foreground font-medium">{fmtBRL(total)}</span></span>
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Nova ferramenta</Button>
          </div>

          {ferramentas.length === 0 ? (
            <EmptyState icon={<Wrench className="h-8 w-8" />} title="Nenhuma ferramenta ainda" description="Cadastre IdP, SIEM, EDR, backup... com custo e status. O orçamento se atualiza sozinho." />
          ) : (
            <div className="space-y-2">
              {ferramentas.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
                  <div className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0"><Wrench className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{f.nome}</span>
                      <StatusBadge tone={TONE[f.status]} size="sm">{LABEL[f.status]}</StatusBadge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[f.categoria, f.fornecedor].filter(Boolean).join(' · ')}
                      {f.custo != null && <span className="text-foreground/80"> · {fmtBRL(Number(f.custo))} {REC_LABEL[f.recorrencia]}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(f); setFormOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleting(f)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogShell>

      <FerramentaDialog open={formOpen} onOpenChange={setFormOpen} ferramenta={editing} fases={fases} onSubmit={onSave} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} onConfirm={async () => { if (deleting) await onDelete(deleting.id); setDeleting(null); }} title="Excluir ferramenta" description={`Excluir "${deleting?.nome}"?`} variant="destructive" />
    </>
  );
}
