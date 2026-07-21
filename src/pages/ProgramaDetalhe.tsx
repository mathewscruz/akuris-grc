import { useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Plus, Flag, Wrench, CheckCircle2, PlayCircle, Circle, Award, ChevronRight, Sparkles, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { ItemDialog } from '@/components/programa/ItemDialog';
import { ProgramaDialog } from '@/components/programa/ProgramaDialog';
import { FaseDialog } from '@/components/programa/FaseDialog';
import { ItensListDialog } from '@/components/programa/ItensListDialog';
import { FerramentasListDialog } from '@/components/programa/FerramentasListDialog';
import { PriorizacaoIA } from '@/components/programa/PriorizacaoIA';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useProgramaDetalhe, type ProgramaItem, type ProgramaFase } from '@/hooks/usePrograma';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { getTemplateForFramework } from '@/lib/programa-templates';

const fmtK = (n: number) => n >= 1000 ? `R$ ${Math.round(n / 1000)}k` : `R$ ${Math.round(n)}`;
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function diasPara(data: string | null): number | null {
  if (!data) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(data + 'T00:00:00').getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

type FaseStatus = 'concluida' | 'andamento' | 'aseguir';
function statusFase(itens: ProgramaItem[]): FaseStatus {
  if (itens.length > 0 && itens.every((i) => i.status === 'concluido')) return 'concluida';
  if (itens.some((i) => i.status !== 'pendente')) return 'andamento';
  return 'aseguir';
}
const FASE_META: Record<FaseStatus, { label: string; icon: any; cls: string; bar: string }> = {
  concluida: { label: 'Concluída', icon: CheckCircle2, cls: 'text-success', bar: 'bg-success' },
  andamento: { label: 'Em andamento', icon: PlayCircle, cls: 'text-primary', bar: 'bg-primary' },
  aseguir: { label: 'A seguir', icon: Circle, cls: 'text-muted-foreground', bar: 'bg-muted-foreground/40' },
};

function KpiCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warning' }) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone === 'warning' ? 'text-warning' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

export default function ProgramaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { empresaId } = useEmpresaId();
  const p = useProgramaDetalhe(id, empresaId);

  const [editProg, setEditProg] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: ProgramaItem | null; faseId: string | null }>({ open: false, item: null, faseId: null });
  const [faseEdit, setFaseEdit] = useState<ProgramaFase | null>(null);
  const [ferrOpen, setFerrOpen] = useState(false);
  const [lista, setLista] = useState<{ open: boolean; title: string; subtitle?: string; itens: ProgramaItem[]; fase: ProgramaFase | null }>({ open: false, title: '', itens: [], fase: null });
  const [novaFase, setNovaFase] = useState('');
  const [addingFase, setAddingFase] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ProgramaItem | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    const res = await p.syncGapAnalysis();
    setSyncing(false);
    if (res) toast.success(`Gap Analysis sincronizado: ${res.added} controle(s) puxado(s), ${res.updated} atualizado(s).`);
  };

  const s = useMemo(() => {
    const itens = p.itens;
    const total = itens.length;
    const done = itens.filter((i) => i.status === 'concluido').length;
    const custoItens = itens.reduce((a, i) => a + Number(i.custo_estimado || 0), 0);
    const custoFerr = p.ferramentas.reduce((a, f) => a + Number(f.custo || 0), 0);
    const geral = custoItens + custoFerr;
    const atrasados = itens.filter((i) => i.status !== 'concluido' && i.prazo && diasPara(i.prazo)! < 0).length;
    const alto = (i: ProgramaItem) => i.impacto === 'alto';
    const leve = (i: ProgramaItem) => i.esforco === 'baixo';
    const quad = {
      quickWins: itens.filter((i) => alto(i) && leve(i)),
      bigBets: itens.filter((i) => alto(i) && !leve(i)),
      fill: itens.filter((i) => !alto(i) && leve(i)),
      reavaliar: itens.filter((i) => !alto(i) && !leve(i)),
    };
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0, custoItens, custoFerr, geral, atrasados, quad };
  }, [p.itens, p.ferramentas]);

  const pendentes = useMemo(() => {
    const faseNome = new Map(p.fases.map((f) => [f.id, f.nome]));
    return p.itens.filter((i) => i.status !== 'concluido').map((i) => ({
      titulo: i.titulo,
      categoria: i.fase_id ? (faseNome.get(i.fase_id) ?? null) : null,
      impacto: i.impacto,
      status: i.status,
    }));
  }, [p.itens, p.fases]);

  const fasesInfo = useMemo(() =>
    p.fases.map((f) => {
      const its = p.itens.filter((i) => i.fase_id === f.id);
      const done = its.filter((i) => i.status === 'concluido').length;
      return { fase: f, itens: its, done, st: statusFase(its), pct: its.length ? Math.round((done / its.length) * 100) : 0 };
    }), [p.fases, p.itens]);

  if (p.loading && !p.programa) return <div className="py-24 flex justify-center"><AkurisPulse size={56} /></div>;
  if (!p.programa) return (
    <div className="py-24 text-center space-y-3">
      <p className="text-muted-foreground">Programa não encontrado.</p>
      <Button variant="outline" onClick={() => navigate('/programa')}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
    </div>
  );

  const prog = p.programa;
  const dias = diasPara(prog.data_alvo);
  const modelo = getTemplateForFramework(prog.framework_nome);
  const orcTotal = prog.orcamento_total ? Number(prog.orcamento_total) : 0;
  const pctComprometido = orcTotal > 0 ? Math.round((s.geral / orcTotal) * 100) : 0;

  const proxima = fasesInfo.find((f) => f.st !== 'concluida');
  const nextItem = p.itens.filter((i) => i.status !== 'concluido' && i.prazo).sort((a, b) => (a.prazo! < b.prazo! ? -1 : 1))[0];
  const marcoNome = proxima?.fase.nome ?? (s.total > 0 ? 'Concluído' : '—');
  const marcoSub = nextItem ? (() => { const d = diasPara(nextItem.prazo!)!; return d < 0 ? 'entrega atrasada' : `vence em ${d} dias`; })() : 'sem prazo definido';

  const openLista = (title: string, itens: ProgramaItem[], fase: ProgramaFase | null, subtitle?: string) =>
    setLista({ open: true, title, subtitle, itens, fase });
  // mantém a lista aberta sincronizada com os dados após um CRUD
  const listaItens = lista.fase ? p.itens.filter((i) => i.fase_id === lista.fase!.id) : lista.itens;

  const handleAddFase = async () => {
    if (!novaFase.trim()) return;
    if (await p.addFase(novaFase.trim())) { setNovaFase(''); setAddingFase(false); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rounded-xl border">
        <CardContent className="p-5">
          <button onClick={() => navigate('/programa')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Programas</button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{prog.nome}</h1>
              <p className="text-sm text-muted-foreground mt-1">{prog.framework_nome || 'Sem framework específico'} · do diagnóstico à certificação</p>
              <div className="inline-flex items-center gap-2 mt-3 bg-accent/10 text-primary rounded-full px-3 py-1.5 text-xs">
                <Flag className="h-3.5 w-3.5" strokeWidth={1.5} />
                {dias == null ? 'Sem data-alvo' : <>Meta: certificar em {new Date(prog.data_alvo! + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} · {dias < 0 ? <span className="text-destructive font-medium">atrasado</span> : <span className="font-medium">faltam {dias} dias</span>}</>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prog.framework_id && (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} title="Puxa os controles e o status de conformidade do Gap Analysis">
                  {syncing ? <AkurisPulse size={16} /> : <RefreshCw className="h-4 w-4 mr-2" />} Sincronizar Gap Analysis
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditProg(true)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Rumo à conclusão" value={`${s.pct}%`} sub={<div className="h-1.5 rounded-full bg-border overflow-hidden mt-1"><div className="h-full bg-primary" style={{ width: `${s.pct}%` }} /></div>} />
        <KpiCard label="Orçamento" value={<>{fmtK(s.geral)} <span className="text-sm text-muted-foreground font-normal">/ {orcTotal ? fmtK(orcTotal) : '—'}</span></>} sub={orcTotal ? `planejado · ${pctComprometido}% comprometido` : 'defina em "Editar"'} />
        <KpiCard label="Próximo marco" value={<span className="text-xl">{marcoNome}</span>} sub={marcoSub} />
        <KpiCard label="Atrasados" value={s.atrasados} sub="itens vencidos" tone={s.atrasados > 0 ? 'warning' : undefined} />
      </div>

      {/* Fases do roadmap */}
      <Card className="rounded-xl border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <h2 className="text-base font-semibold">Fases do roadmap</h2>
            <div className="flex items-center gap-2">
              {addingFase ? (
                <div className="flex items-center gap-2">
                  <Input autoFocus value={novaFase} onChange={(e) => setNovaFase(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFase()} placeholder="Nome da fase" className="h-8 w-44" />
                  <Button size="sm" onClick={handleAddFase}>Adicionar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingFase(false); setNovaFase(''); }}>Cancelar</Button>
                </div>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setAddingFase(true)}><Plus className="h-4 w-4 mr-1" /> Fase</Button>
                  <Button size="sm" onClick={() => setItemDialog({ open: true, item: null, faseId: null })}><Plus className="h-4 w-4 mr-1" /> Item</Button>
                </>
              )}
            </div>
          </div>

          {fasesInfo.length === 0 ? (
            <div className="space-y-3">
              <EmptyState icon={<Award className="h-8 w-8" />} title="Puxe os controles ou use um modelo" description={prog.framework_id ? 'Vincule ao Gap Analysis para trazer os controles do framework com o status de conformidade real — ou comece com um modelo pronto.' : 'Gere o roadmap típico do framework — fases e itens já preenchidos com esforço, custo e ferramenta. Você só ajusta.'} />
              <div className="flex justify-center gap-2 flex-wrap">
                {prog.framework_id && <Button variant="outline" onClick={handleSync} disabled={syncing}>{syncing ? <AkurisPulse size={16} /> : <RefreshCw className="h-4 w-4 mr-2" />} Puxar controles do Gap Analysis</Button>}
                <Button onClick={() => p.aplicarTemplate(modelo)}><Plus className="h-4 w-4 mr-2" /> Usar modelo {modelo.label}</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {fasesInfo.map(({ fase, itens, done, st, pct }) => {
                const meta = FASE_META[st];
                const MetaIcon = meta.icon;
                return (
                  <button key={fase.id} onClick={() => openLista(fase.nome, itens, fase, `${done}/${itens.length} itens`)}
                    className={`flex-1 min-w-[130px] text-left rounded-lg border p-3 transition-colors hover:border-primary/40 ${st === 'andamento' ? 'border-primary/50' : 'border-border'}`}>
                    <div className={`flex items-center gap-1.5 text-xs ${meta.cls}`}><MetaIcon className="h-3.5 w-3.5" strokeWidth={1.5} /> {meta.label}</div>
                    <div className="text-sm font-medium mt-1.5 leading-snug">{fase.nome}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{done}/{itens.length} itens</div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden mt-2"><div className={`h-full ${meta.bar}`} style={{ width: `${pct}%` }} /></div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matriz + Orçamento */}
      <div className="grid gap-4 md:grid-cols-2">
        <PriorizacaoIA frameworkNome={prog.framework_nome} itens={pendentes} />

        <Card className="rounded-xl border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Orçamento e ferramentas</h3>
                <p className="text-xs text-muted-foreground mb-3">O quanto você quer gastar, e com o quê</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Implementação (itens)</span><span className="font-medium">{fmtBRL(s.custoItens)}</span></div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden mt-1.5"><div className="h-full bg-primary" style={{ width: `${s.geral ? Math.round((s.custoItens / s.geral) * 100) : 0}%` }} /></div>
              </div>
              <button onClick={() => setFerrOpen(true)} className="w-full text-left group">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Wrench className="h-3.5 w-3.5" strokeWidth={1.5} />Ferramentas <span className="text-xs">({p.ferramentas.length})</span> <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" /></span>
                  <span className="font-medium">{fmtBRL(s.custoFerr)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden mt-1.5"><div className="h-full" style={{ width: `${s.geral ? Math.round((s.custoFerr / s.geral) * 100) : 0}%`, background: '#5DCAA5' }} /></div>
              </button>
              <div className="border-t border-border pt-3 flex justify-between text-sm">
                <span className="font-medium">Total estimado</span>
                <span className="font-medium">{fmtBRL(s.geral)}{orcTotal ? <span className="text-muted-foreground font-normal"> de {fmtBRL(orcTotal)}</span> : ''}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setFerrOpen(true)}><Wrench className="h-4 w-4 mr-2" /> Gerir ferramentas</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs (desdobramentos) */}
      <ItensListDialog
        open={lista.open}
        onOpenChange={(o) => setLista((st) => ({ ...st, open: o }))}
        title={lista.title}
        subtitle={lista.subtitle}
        itens={listaItens}
        fase={lista.fase}
        onToggleStatus={p.setItemStatus}
        onEdit={(it) => setItemDialog({ open: true, item: it, faseId: it.fase_id })}
        onDelete={(it) => setDeleteItem(it)}
        onAdd={lista.fase ? () => setItemDialog({ open: true, item: null, faseId: lista.fase!.id }) : undefined}
        onEditFase={lista.fase ? () => setFaseEdit(lista.fase) : undefined}
      />
      <FerramentasListDialog open={ferrOpen} onOpenChange={setFerrOpen} ferramentas={p.ferramentas} fases={p.fases} onSave={p.saveFerramenta} onDelete={p.deleteFerramenta} />

      <ItemDialog open={itemDialog.open} onOpenChange={(o) => setItemDialog((st) => ({ ...st, open: o }))} item={itemDialog.item} fases={p.fases} defaultFaseId={itemDialog.faseId} onSubmit={p.saveItem} />
      <ProgramaDialog open={editProg} onOpenChange={setEditProg} programa={prog} onSubmit={async (v) => p.updatePrograma(v)} />
      <FaseDialog open={!!faseEdit} onOpenChange={(o) => !o && setFaseEdit(null)} fase={faseEdit} onSubmit={p.updateFase} />

      <ConfirmDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)} onConfirm={async () => { if (deleteItem) await p.deleteItem(deleteItem.id); setDeleteItem(null); }} title="Excluir item" description={`Excluir "${deleteItem?.titulo}"?`} variant="destructive" />
    </div>
  );
}
