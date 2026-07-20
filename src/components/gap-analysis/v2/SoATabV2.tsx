/**
 * SoATabV2 — Onda 5 Akuris.
 * 7 KPIs editoriais + filtros segmentados (Cláusulas/Anexo A/Todos) + tabela
 * com checkbox e observações inline + BulkActionBar dark sticky.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Search, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { toast } from 'sonner';
import { exportSoAPDF } from '../SoAExportPDF';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveConformityTone } from '@/lib/status-tone';
import { KpiTiny } from './KpiTiny';
import { BulkActionBar } from './BulkActionBar';
import { cn } from '@/lib/utils';

interface SoAItem {
  id: string;
  codigo: string;
  titulo: string;
  categoria: string;
  aplicavel: boolean;
  justificativa: string;
  conformity_status: string;
  responsavel: string | null;
  evidencias_count: number;
}

interface Props {
  frameworkId: string;
  frameworkName: string;
  frameworkVersion: string;
}

const STATUS_LABELS: Record<string, string> = {
  conforme: 'Conforme',
  parcial: 'Parcial',
  nao_conforme: 'Não Conforme',
  nao_aplicavel: 'N/A',
  nao_avaliado: 'Não Avaliado',
};

type Segment = 'todos' | 'clausulas' | 'anexo_a';

const SEGMENTS: Array<{ key: Segment; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'clausulas', label: 'Cláusulas' },
  { key: 'anexo_a', label: 'Anexo A' },
];

export function SoATabV2({ frameworkId, frameworkName, frameworkVersion }: Props) {
  const { empresaId } = useEmpresaId();
  const [items, setItems] = useState<SoAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('todos');
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!frameworkId || !empresaId) return;
    loadSoAData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkId, empresaId]);

  const loadSoAData = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [reqsRes, evalsRes] = await Promise.all([
        supabase
          .from('gap_analysis_requirements')
          .select('id, codigo, titulo, categoria, area_responsavel')
          .eq('framework_id', frameworkId)
          .order('ordem', { ascending: true }),
        supabase
          .from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status, observacoes')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId),
      ]);

      const reqs = reqsRes.data || [];
      const evals = evalsRes.data || [];
      const evalMap = new Map(evals.map(e => [e.requirement_id, e]));

      let soaMap = new Map<string, { aplicavel: boolean; justificativa: string }>();
      try {
        const { data: soaData } = await supabase
          .from('gap_analysis_soa')
          .select('requirement_id, aplicavel, justificativa')
          .eq('framework_id', frameworkId)
          .eq('empresa_id', empresaId);
        (soaData as any[] | null)?.forEach(s => {
          soaMap.set(s.requirement_id, { aplicavel: s.aplicavel, justificativa: s.justificativa || '' });
        });
      } catch {}

      const soaItems: SoAItem[] = reqs.map(r => {
        const evalData = evalMap.get(r.id);
        const soaEntry = soaMap.get(r.id);
        const status = evalData?.conformity_status || 'nao_avaliado';
        const isNA = status === 'nao_aplicavel';
        return {
          id: r.id,
          codigo: r.codigo || '',
          titulo: r.titulo,
          categoria: r.categoria || 'Outros',
          aplicavel: soaEntry ? soaEntry.aplicavel : !isNA,
          justificativa: soaEntry?.justificativa || (isNA ? (evalData?.observacoes || '') : ''),
          conformity_status: status,
          responsavel: r.area_responsavel,
          evidencias_count: 0,
        };
      });

      setItems(soaItems);
      const justMap: Record<string, string> = {};
      soaItems.forEach(item => { justMap[item.id] = item.justificativa; });
      setJustificativas(justMap);
    } catch {
      toast.error('Erro ao carregar dados da SoA');
    } finally {
      setLoading(false);
    }
  };

  // Em ISO 27001: códigos "4-10" são cláusulas, "A.x.y" são Anexo A.
  const isAnexoA = (codigo: string) => /^a\.?\s?\d/i.test(codigo);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (search) {
        const s = search.toLowerCase();
        if (!item.codigo.toLowerCase().includes(s) && !item.titulo.toLowerCase().includes(s)) return false;
      }
      if (segment === 'clausulas' && isAnexoA(item.codigo)) return false;
      if (segment === 'anexo_a' && !isAnexoA(item.codigo)) return false;
      return true;
    });
  }, [items, search, segment]);

  const stats = useMemo(() => {
    const total = items.length;
    const aplicavel = items.filter(i => i.aplicavel).length;
    const naoAplicavel = total - aplicavel;
    const conforme = items.filter(i => i.aplicavel && i.conformity_status === 'conforme').length;
    const parcial = items.filter(i => i.aplicavel && i.conformity_status === 'parcial').length;
    const naoConforme = items.filter(i => i.aplicavel && i.conformity_status === 'nao_conforme').length;
    const naoAvaliado = items.filter(i => i.aplicavel && i.conformity_status === 'nao_avaliado').length;
    return { total, aplicavel, naoAplicavel, conforme, parcial, naoConforme, naoAvaliado };
  }, [items]);

  const toggleApplicability = (id: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, aplicavel: !item.aplicavel } : item)));
  };

  const updateJustificativa = (id: string, value: string) => {
    setJustificativas(prev => ({ ...prev, [id]: value }));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === filteredItems.length) setSelected(new Set());
    else setSelected(new Set(filteredItems.map(i => i.id)));
  };

  const bulkChangeStatus = async (status: string) => {
    if (!empresaId || selected.size === 0) return;
    try {
      const records = Array.from(selected).map(reqId => ({
        framework_id: frameworkId,
        empresa_id: empresaId,
        requirement_id: reqId,
        conformity_status: status,
      }));
      const { error } = await supabase
        .from('gap_analysis_evaluations')
        .upsert(records, { onConflict: 'framework_id,empresa_id,requirement_id' });
      if (error) throw error;
      toast.success(`${selected.size} requisito(s) atualizado(s) para ${STATUS_LABELS[status] || status}`);
      setSelected(new Set());
      loadSoAData();
    } catch (e: any) {
      toast.error('Erro ao atualizar em lote');
    }
  };

  const handleSave = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      const records = items.map(item => ({
        framework_id: frameworkId,
        empresa_id: empresaId,
        requirement_id: item.id,
        aplicavel: item.aplicavel,
        justificativa: justificativas[item.id] || '',
      }));
      const { error } = await supabase
        .from('gap_analysis_soa')
        .upsert(records, { onConflict: 'framework_id,empresa_id,requirement_id' });
      if (error) throw error;
      toast.success('Declaração de Aplicabilidade salva com sucesso');
    } catch {
      toast.error('Erro ao salvar SoA');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { data: empresa } = await supabase
        .from('empresas').select('nome').eq('id', empresaId).single();
      await exportSoAPDF({
        frameworkName,
        frameworkVersion,
        empresaNome: empresa?.nome || 'Empresa',
        items: items.map(item => ({ ...item, justificativa: justificativas[item.id] || item.justificativa })),
        stats,
      });
      toast.success('PDF da SoA exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[280px] flex flex-col items-center justify-center gap-3">
        <AkurisPulse size={56} />
        <p className="text-sm text-muted-foreground">Carregando SoA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* 7 KPIs editoriais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <KpiTiny eyebrow="TOTAL" value={stats.total} foot="requisitos" />
        <KpiTiny eyebrow="APLICÁVEIS" value={stats.aplicavel} foot="no escopo" tone="primary" />
        <KpiTiny eyebrow="N/A" value={stats.naoAplicavel} foot="fora do escopo" />
        <KpiTiny eyebrow="CONFORMES" value={stats.conforme} tone="success" />
        <KpiTiny eyebrow="PARCIAIS" value={stats.parcial} tone="warning" />
        <KpiTiny eyebrow="NÃO CONFORMES" value={stats.naoConforme} tone="destructive" />
        <KpiTiny eyebrow="NÃO AVALIADOS" value={stats.naoAvaliado} />
      </div>

      {/* Toolbar com segmentos */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          {SEGMENTS.map(seg => (
            <button
              key={seg.key}
              type="button"
              onClick={() => setSegment(seg.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                segment === seg.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {seg.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Buscar por código ou título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar SoA'}
          </Button>
          <Button onClick={handleExportPDF} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" strokeWidth={1.5} />
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />
            Declaração de Aplicabilidade (SoA)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Para a certificação, cada controle aplicável precisa de uma justificativa de inclusão (e cada exclusão, sua razão). Preencha a coluna Justificativa e clique em "Salvar SoA".
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredItems.length > 0 && selected.size === filteredItems.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Requisito</TableHead>
                  <TableHead className="w-28">Aplicável</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-32">Responsável</TableHead>
                  <TableHead className="w-20 text-center">Evid.</TableHead>
                  <TableHead className="min-w-[200px]">Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => {
                  const statusKey = item.conformity_status || 'nao_avaliado';
                  const isSelected = selected.has(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        !item.aplicavel && 'opacity-60',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Selecionar ${item.codigo}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={item.titulo}>
                        {item.titulo}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={item.aplicavel ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleApplicability(item.id)}
                        >
                          {item.aplicavel ? 'Sim' : 'Não'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge size="sm" {...resolveConformityTone(statusKey)}>
                          {STATUS_LABELS[statusKey] || statusKey}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.responsavel || '—'}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {item.evidencias_count > 0 ? (
                          <Badge variant="secondary" className="text-xs">{item.evidencias_count}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Textarea
                          placeholder={!item.aplicavel ? 'Justificativa para exclusão...' : 'Observações...'}
                          value={justificativas[item.id] || ''}
                          onChange={e => updateJustificativa(item.id, e.target.value)}
                          rows={1}
                          className="text-xs min-h-[32px] resize-none"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum requisito encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        onStatusChange={bulkChangeStatus}
        onAssign={() => toast.info('Atribuição em lote em breve')}
        onSetDeadline={() => toast.info('Prazo em lote em breve')}
        onCreatePlan={() => toast.info('Plano em lote em breve')}
        onGenerateJustification={() => toast.info('Geração de justificativa IA em breve')}
      />
    </div>
  );
}
