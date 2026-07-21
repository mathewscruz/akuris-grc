import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Plus, Target, Wallet, CalendarClock, AlertTriangle,
  MoreHorizontal, Trash2, Circle, CircleDot, CheckCircle2, Layers, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ItemDialog } from '@/components/programa/ItemDialog';
import { ProgramaDialog } from '@/components/programa/ProgramaDialog';
import { useProgramaDetalhe, type ProgramaItem, type ItemStatus } from '@/hooks/usePrograma';
import { useEmpresaId } from '@/hooks/useEmpresaId';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const NIVEL_LABEL: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
const STATUS_CYCLE: Record<ItemStatus, ItemStatus> = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' };

function diasPara(data: string | null): number | null {
  if (!data) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(data + 'T00:00:00').getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === 'concluido') return <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />;
  if (status === 'em_andamento') return <CircleDot className="h-5 w-5 text-primary" strokeWidth={1.5} />;
  return <Circle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />;
}

export default function ProgramaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { empresaId } = useEmpresaId();
  const p = useProgramaDetalhe(id, empresaId);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: ProgramaItem | null; faseId: string | null }>({ open: false, item: null, faseId: null });
  const [editProg, setEditProg] = useState(false);
  const [novaFase, setNovaFase] = useState('');
  const [addingFase, setAddingFase] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ProgramaItem | null>(null);
  const [deleteFaseId, setDeleteFaseId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = p.itens.length;
    const done = p.itens.filter((i) => i.status === 'concluido').length;
    const custo = p.itens.reduce((s, i) => s + Number(i.custo_estimado || 0), 0);
    const prazos = p.itens.filter((i) => i.status !== 'concluido' && i.prazo).map((i) => i.prazo!) as string[];
    const proximo = prazos.sort()[0] || null;
    const alto = (i: ProgramaItem) => i.impacto === 'alto';
    const leve = (i: ProgramaItem) => i.esforco === 'baixo';
    const matriz = {
      quickWins: p.itens.filter((i) => alto(i) && leve(i)).length,
      bigBets: p.itens.filter((i) => alto(i) && !leve(i)).length,
      fill: p.itens.filter((i) => !alto(i) && leve(i)).length,
      reavaliar: p.itens.filter((i) => !alto(i) && !leve(i)).length,
    };
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0, custo, proximo, matriz };
  }, [p.itens]);

  const grupos = useMemo(() => {
    const g = p.fases.map((f) => ({ fase: f, itens: p.itens.filter((i) => i.fase_id === f.id) }));
    const semFase = p.itens.filter((i) => !i.fase_id);
    return { g, semFase };
  }, [p.fases, p.itens]);

  if (p.loading && !p.programa) return <div className="py-24 flex justify-center"><AkurisPulse size={56} /></div>;
  if (!p.programa) return (
    <div className="py-24 text-center space-y-3">
      <p className="text-muted-foreground">Programa não encontrado.</p>
      <Button variant="outline" onClick={() => navigate('/programa')}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
    </div>
  );

  const prog = p.programa;
  const dias = diasPara(prog.data_alvo);

  const handleAddFase = async () => {
    if (!novaFase.trim()) return;
    const ok = await p.addFase(novaFase.trim());
    if (ok) { setNovaFase(''); setAddingFase(false); }
  };

  const renderItem = (it: ProgramaItem) => (
    <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <button onClick={() => p.setItemStatus(it.id, STATUS_CYCLE[it.status])} title="Alterar status" className="shrink-0">
        <StatusIcon status={it.status} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium truncate ${it.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>{it.titulo}</span>
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
          <DropdownMenuItem onClick={() => setItemDialog({ open: true, item: it, faseId: it.fase_id })}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteItem(it)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate('/programa')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Programas</button>
          <h1 className="text-2xl font-semibold tracking-tight">{prog.nome}</h1>
          <p className="text-sm text-muted-foreground mt-1">{prog.framework_nome || 'Sem framework específico'}{prog.descricao ? ` · ${prog.descricao}` : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditProg(true)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Progresso" value={`${stats.pct}%`} icon={<Target />} variant="primary" showAccent />
        <StatCard title="Orçamento" value={fmtBRL(stats.custo)} icon={<Wallet />} variant="info" emptyHint={prog.orcamento_total ? `de ${fmtBRL(prog.orcamento_total)}` : undefined} />
        <StatCard title="Data-alvo" value={dias == null ? '—' : dias < 0 ? 'Atrasado' : `${dias} dias`} icon={<CalendarClock />} variant={dias != null && dias < 0 ? 'destructive' : 'default'} />
        <StatCard title="Itens" value={`${stats.done}/${stats.total}`} icon={<ListChecks />} variant="default" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl border">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-1">Por onde começar</h3>
            <p className="text-xs text-muted-foreground mb-3">Impacto × esforço</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: 'hsl(160 60% 94%)' }}><div className="text-xs font-medium" style={{ color: 'hsl(168 70% 24%)' }}>Quick wins</div><div className="text-2xl font-semibold" style={{ color: 'hsl(170 80% 14%)' }}>{stats.matriz.quickWins}</div></div>
              <div className="rounded-lg p-3" style={{ background: 'hsl(38 90% 92%)' }}><div className="text-xs font-medium" style={{ color: 'hsl(30 80% 30%)' }}>Grandes apostas</div><div className="text-2xl font-semibold" style={{ color: 'hsl(28 80% 18%)' }}>{stats.matriz.bigBets}</div></div>
              <div className="rounded-lg p-3 bg-muted/50"><div className="text-xs font-medium text-muted-foreground">Preencher folgas</div><div className="text-2xl font-semibold">{stats.matriz.fill}</div></div>
              <div className="rounded-lg p-3 bg-muted/50"><div className="text-xs font-medium text-muted-foreground">Reavaliar</div><div className="text-2xl font-semibold">{stats.matriz.reavaliar}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-1">Orçamento</h3>
            <p className="text-xs text-muted-foreground mb-3">Custo estimado somado dos itens</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmtBRL(stats.custo)}</span>
              {prog.orcamento_total ? <span className="text-sm text-muted-foreground">de {fmtBRL(prog.orcamento_total)}</span> : null}
            </div>
            {prog.orcamento_total ? (
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-3">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round((stats.custo / Number(prog.orcamento_total)) * 100))}%` }} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fases e itens</h2>
        <div className="flex items-center gap-2">
          {addingFase ? (
            <div className="flex items-center gap-2">
              <Input autoFocus value={novaFase} onChange={(e) => setNovaFase(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFase()} placeholder="Nome da fase" className="h-9 w-48" />
              <Button size="sm" onClick={handleAddFase}>Adicionar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingFase(false); setNovaFase(''); }}>Cancelar</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingFase(true)}><Layers className="h-4 w-4 mr-2" /> Nova fase</Button>
          )}
          <Button size="sm" onClick={() => setItemDialog({ open: true, item: null, faseId: null })}><Plus className="h-4 w-4 mr-2" /> Novo item</Button>
        </div>
      </div>

      {p.fases.length === 0 && p.itens.length === 0 ? (
        <EmptyState icon={<Layers className="h-8 w-8" />} title="Comece pelas fases" description="Crie fases (ex.: Escopo e SoA, Avaliação de riscos, Políticas...) e adicione itens do que precisa ser feito, com custo, prazo e ferramenta." />
      ) : (
        <div className="space-y-5">
          {grupos.g.map(({ fase, itens }) => {
            const fdone = itens.filter((i) => i.status === 'concluido').length;
            return (
              <div key={fase.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={itens.length > 0 && fdone === itens.length ? 'success' : 'neutral'} size="sm">{fase.nome}</StatusBadge>
                    <span className="text-xs text-muted-foreground">{fdone}/{itens.length} concluídos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setItemDialog({ open: true, item: null, faseId: fase.id })}><Plus className="h-4 w-4 mr-1" /> Item</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteFaseId(fase.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {itens.length === 0 ? <p className="text-xs text-muted-foreground px-1 py-2">Nenhum item nesta fase.</p> : <div className="space-y-2">{itens.map(renderItem)}</div>}
              </div>
            );
          })}
          {grupos.semFase.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><StatusBadge tone="neutral" variant="outline" size="sm">Sem fase</StatusBadge><span className="text-xs text-muted-foreground">{grupos.semFase.length} itens</span></div>
              <div className="space-y-2">{grupos.semFase.map(renderItem)}</div>
            </div>
          )}
        </div>
      )}

      <ItemDialog open={itemDialog.open} onOpenChange={(o) => setItemDialog((s) => ({ ...s, open: o }))} item={itemDialog.item} fases={p.fases} defaultFaseId={itemDialog.faseId} onSubmit={p.saveItem} />
      <ProgramaDialog open={editProg} onOpenChange={setEditProg} programa={prog} onSubmit={async (v) => p.updatePrograma(v)} />

      <ConfirmDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} onConfirm={async () => { if (deleteItem) await p.deleteItem(deleteItem.id); setDeleteItem(null); }} title="Excluir item" description={`Excluir "${deleteItem?.titulo}"?`} variant="destructive" />
      <ConfirmDialog open={!!deleteFaseId} onOpenChange={(o) => !o && setDeleteFaseId(null)} onConfirm={async () => { if (deleteFaseId) await p.deleteFase(deleteFaseId); setDeleteFaseId(null); }} title="Excluir fase" description="A fase será removida. Os itens dela ficam sem fase (não são excluídos)." variant="destructive" />
    </div>
  );
}
