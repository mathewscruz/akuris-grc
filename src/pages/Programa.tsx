import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Plus, Target, Wallet, MoreHorizontal, Trash2, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ProgramaDialog } from '@/components/programa/ProgramaDialog';
import { useProgramas, type Programa } from '@/hooks/usePrograma';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { akurisToast } from '@/lib/akuris-toast';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function diasPara(data: string | null): number | null {
  if (!data) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data + 'T00:00:00');
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Programa() {
  const navigate = useNavigate();
  const { empresaId } = useEmpresaId();
  const lib = useProgramas(empresaId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Programa | null>(null);

  const handleCreate = async (values: any, template?: any) => {
    const created = await lib.createPrograma(values, template);
    if (created) { navigate(`/programa/${created.id}`); return true; }
    return false;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await lib.deletePrograma(deleting.id);
    if (ok) akurisToast({ module: 'gap', tone: 'success', title: 'Programa excluído', description: deleting.nome });
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programa de implementação"
        description="Acompanhe toda a jornada de adequação a um framework — fases, o que fazer, custos, ferramentas e prazos, num só lugar."
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo programa</Button>}
      />

      {lib.loading ? (
        <div className="py-16 flex justify-center"><AkurisPulse size={56} /></div>
      ) : lib.programas.length === 0 ? (
        <EmptyState
          variant="illustrated"
          icon={<Rocket className="h-8 w-8" />}
          title="Nenhum programa ainda"
          description="Crie um programa para transformar o gap analysis num roadmap de implementação com fases, custos e prazos."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lib.programas.map((p) => {
            const total = p.total_itens || 0;
            const done = p.itens_concluidos || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const dias = diasPara(p.data_alvo);
            return (
              <Card key={p.id} className="rounded-xl border cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/programa/${p.id}`)}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold truncate">{p.nome}</h3>
                      {p.framework_nome && <p className="text-xs text-muted-foreground mt-0.5">{p.framework_nome}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setDeleting(p)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{pct}% · {done}/{total} itens</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {dias == null ? 'Sem data-alvo' : dias < 0 ? <span className="text-destructive">Atrasado</span> : `${dias} dias`}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {fmtBRL(p.custo_estimado || 0)}{p.orcamento_total ? ` / ${fmtBRL(p.orcamento_total)}` : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProgramaDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={confirmDelete}
        title="Excluir programa"
        description={`Excluir "${deleting?.nome}"? Todas as fases e itens serão removidos. Esta ação não pode ser desfeita.`}
        variant="destructive"
      />
    </div>
  );
}
