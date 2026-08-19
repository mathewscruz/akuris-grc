/**
 * SoATabV2 — Onda 5 Akuris.
 * 7 KPIs editoriais + filtros segmentados (Cláusulas/Anexo A/Todos) + tabela
 * com checkbox e observações inline + BulkActionBar dark sticky.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead, useTableSort } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
;
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
import { reqTitulo, reqCategoria } from "@/lib/gap-i18n";
import { useRequisitoRiscos } from '@/hooks/useRiscoRequisitos';
import { useRequisitoControles } from '@/hooks/useControleRequisitos';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconSearch, IconDownload, IconFile, IconShieldAlert } from '@/components/icons';

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
  /**
   * Secções do framework, vindas de `getFrameworkConfig`.
   *
   * Os segmentos desta barra eram três valores fixos — Todos / Cláusulas /
   * Anexo A —, que só descrevem a ISO 27001. Em qualquer outro framework o
   * segundo botão devolvia a lista inteira e o terceiro devolvia nada, porque
   * o teste era "o código começa por A.". Agora vêm do mesmo sítio que a
   * tabela de requisitos já usa; quem não tem secções fica só com "Todos".
   */
  sections?: { id: string; title: string; filter: (codigo: string | null) => boolean }[];
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  conforme: 'gapV2.soa.statusConforme',
  parcial: 'gapV2.soa.statusParcial',
  nao_conforme: 'gapV2.soa.statusNaoConforme',
  nao_aplicavel: 'gapV2.soa.statusNaoAplicavel',
  nao_avaliado: 'gapV2.soa.statusNaoAvaliado',
};

/** `todos`, ou o id de uma secção do framework. */
type Segment = string;


export function SoATabV2({ frameworkId, frameworkName, frameworkVersion, sections }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [items, setItems] = useState<SoAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('todos');
  const segmentos = [{ id: 'todos', title: t('gapV2.soa.segAll') }, ...(sections || [])];
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  // ISO 27001 6.1.3 d) — a justificação de inclusão deriva dos riscos que o controlo trata.
  const { data: riscosPorRequisito } = useRequisitoRiscos(frameworkId);
  // ISO 27001 6.1.3 d) — a SoA cita também os controlos internos reais que implementam o requisito.
  const { data: controlosPorRequisito } = useRequisitoControles(frameworkId);

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
          .select('id, codigo, titulo, categoria, area_responsavel, titulo_en, categoria_en')
          .eq('framework_id', frameworkId)
          .order('ordem', { ascending: true }),
        supabase
          .from('gap_analysis_evaluations')
          .select('requirement_id, conformity_status, observacoes, evidence_files')
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
          titulo: reqTitulo(r as any),
          categoria: reqCategoria(r as any) || 'Outros',
          aplicavel: soaEntry ? soaEntry.aplicavel : !isNA,
          justificativa: soaEntry?.justificativa || (isNA ? (evalData?.observacoes || '') : ''),
          conformity_status: status,
          responsavel: r.area_responsavel,
          // Era um literal `0`: a SoA exportada declarava zero evidências em
          // todas as linhas, mesmo nas que têm ficheiro anexado. Numa
          // Declaração de Aplicabilidade isso lê-se como "nada comprovado".
          evidencias_count: Array.isArray((evalData as any)?.evidence_files)
            ? (evalData as any).evidence_files.length
            : 0,
        };
      });

      setItems(soaItems);
      const justMap: Record<string, string> = {};
      soaItems.forEach(item => { justMap[item.id] = item.justificativa; });
      setJustificativas(justMap);
    } catch {
      toast.error(t('gapV2.soa.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  // Em ISO 27001: códigos "4-10" são cláusulas, "A.x.y" são Anexo A.

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (search) {
        const s = search.toLowerCase();
        if (!item.codigo.toLowerCase().includes(s) && !item.titulo.toLowerCase().includes(s)) return false;
      }
      if (segment !== 'todos') {
        const seccao = sections?.find(sec => sec.id === segment);
        if (seccao && !seccao.filter(item.codigo)) return false;
      }
      return true;
    });
  }, [items, search, segment]);

  const { sorted: sortedItems, sort, toggleSort } = useTableSort(filteredItems as any[], {
    riscos: (item: any) => riscosPorRequisito?.get(item.id)?.length ?? 0,
  });

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
      toast.success(t('gapV2.soa.bulkUpdateSuccess', { count: selected.size, status: t(STATUS_LABEL_KEYS[status]) || status }));
      setSelected(new Set());
      loadSoAData();
    } catch (e: any) {
      toast.error(t('gapV2.soa.errorBulkUpdate'));
    }
  };

  /** Gera a justificação de inclusão a partir dos riscos associados (SoA 6.1.3 d). */
  const gerarJustificacoes = () => {
    const alvos = selected.size > 0 ? Array.from(selected) : filteredItems.map(i => i.id);
    let geradas = 0;
    const next: Record<string, string> = { ...justificativas };
    alvos.forEach(id => {
      const riscos = riscosPorRequisito?.get(id) || [];
      const controlos = controlosPorRequisito?.get(id) || [];
      if (riscos.length === 0 && controlos.length === 0) return;
      const partes: string[] = [];
      if (riscos.length > 0) {
        partes.push(t('riscosControles.soa.justificacaoTexto', {
          count: riscos.length,
          riscos: riscos.map(r => r.nome).join('; '),
        }));
      }
      if (controlos.length > 0) {
        partes.push(t('vinculoReq.soaJustificacaoControlos', {
          controlos: controlos.map(c => c.nome).join('; '),
        }));
      }
      next[id] = partes.join(' ');
      geradas++;
    });
    if (geradas === 0) {
      toast.info(t('riscosControles.soa.semRiscosSelecionados'));
      return;
    }
    setJustificativas(next);
    toast.success(t('riscosControles.soa.justificacaoGerada', { count: geradas }));
  };

  const handleSave = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      // 1) Grava a SoA (aplicabilidade + justificativa)
      const soaRecords = items.map(item => ({
        framework_id: frameworkId,
        empresa_id: empresaId,
        requirement_id: item.id,
        aplicavel: item.aplicavel,
        justificativa: justificativas[item.id] || '',
      }));
      const { error: soaErr } = await supabase
        .from('gap_analysis_soa')
        .upsert(soaRecords, { onConflict: 'framework_id,empresa_id,requirement_id' });
      if (soaErr) throw soaErr;

      // 2) Reflete a aplicabilidade no score: marca N/A no evaluations quando
      //    !aplicavel, e reverte para 'nao_avaliado' quando aplicavel mas o
      //    status atual está travado em 'nao_aplicavel'. Sem essa etapa a SoA
      //    ficava desconectada do score real (bug histórico).
      const naRecords = items
        .filter(item => !item.aplicavel)
        .map(item => ({
          framework_id: frameworkId,
          empresa_id: empresaId,
          requirement_id: item.id,
          conformity_status: 'nao_aplicavel',
          observacoes: justificativas[item.id] || null,
          updated_at: new Date().toISOString(),
        }));
      const revertRecords = items
        .filter(item => item.aplicavel && item.conformity_status === 'nao_aplicavel')
        .map(item => ({
          framework_id: frameworkId,
          empresa_id: empresaId,
          requirement_id: item.id,
          conformity_status: 'nao_avaliado',
          updated_at: new Date().toISOString(),
        }));
      const evalRecords = [...naRecords, ...revertRecords];
      if (evalRecords.length > 0) {
        const { error: evalErr } = await supabase
          .from('gap_analysis_evaluations')
          .upsert(evalRecords, { onConflict: 'framework_id,empresa_id,requirement_id' });
        if (evalErr) throw evalErr;
      }

      toast.success(t('gapV2.soa.saveSuccess'));
      loadSoAData();
    } catch {
      toast.error(t('gapV2.soa.errorSave'));
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
      toast.success(t('gapV2.soa.exportSuccess'));
    } catch {
      toast.error(t('gapV2.soa.errorExport'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[280px] flex flex-col items-center justify-center gap-3">
        <AkurisPulse size={56} />
        <p className="text-sm text-muted-foreground">{t('gapV2.soa.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* 7 KPIs editoriais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <KpiTiny eyebrow={t('gapV2.soa.kpiTotal')} value={stats.total} foot={t('gapV2.soa.footRequirements')} />
        <KpiTiny eyebrow={t('gapV2.soa.kpiApplicable')} value={stats.aplicavel} foot={t('gapV2.soa.footInScope')} tone="primary" />
        <KpiTiny eyebrow={t('gapV2.soa.kpiNA')} value={stats.naoAplicavel} foot={t('gapV2.soa.footOutOfScope')} />
        <KpiTiny eyebrow={t('gapV2.soa.kpiConforme')} value={stats.conforme} tone="success" />
        <KpiTiny eyebrow={t('gapV2.soa.kpiParcial')} value={stats.parcial} tone="warning" />
        <KpiTiny eyebrow={t('gapV2.soa.kpiNaoConforme')} value={stats.naoConforme} tone="destructive" />
        <KpiTiny eyebrow={t('gapV2.soa.kpiNaoAvaliado')} value={stats.naoAvaliado} />
      </div>

      {/* Toolbar com segmentos */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          {segmentos.map(seg => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setSegment(seg.id)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                segment === seg.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {seg.title}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder={t('gapV2.soa.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={gerarJustificacoes}>
            <IconShieldAlert className="h-4 w-4 mr-2" strokeWidth={1.5} />
            {t('riscosControles.soa.gerarJustificacao')}
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? t('gapV2.soa.saving') : t('gapV2.soa.saveButton')}
          </Button>
          <Button onClick={handleExportPDF} disabled={exporting}>
            <IconDownload className="h-4 w-4 mr-2" strokeWidth={1.5} />
            {exporting ? t('gapV2.soa.exporting') : t('gapV2.soa.exportButton')}
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconFile className="h-5 w-5 text-primary" strokeWidth={1.5} />
            {t('gapV2.soa.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('gapV2.soa.description')}
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
                      aria-label={t('gapV2.soa.selectAll')}
                    />
                  </TableHead>
                  <SortableTableHead field="codigo" sort={sort} onSort={toggleSort} className="w-24">{t('gapV2.soa.colCode')}</SortableTableHead>
                  <SortableTableHead field="titulo" sort={sort} onSort={toggleSort}>{t('gapV2.soa.colRequirement')}</SortableTableHead>
                  <SortableTableHead field="aplicavel" sort={sort} onSort={toggleSort} className="w-28">{t('gapV2.soa.colApplicable')}</SortableTableHead>
                  <SortableTableHead field="conformity_status" sort={sort} onSort={toggleSort} className="w-32">{t('gapV2.soa.colStatus')}</SortableTableHead>
                  <SortableTableHead field="riscos" sort={sort} onSort={toggleSort} className="w-40">{t('riscosControles.soa.colRiscos')}</SortableTableHead>
                  <SortableTableHead field="responsavel_avaliacao" sort={sort} onSort={toggleSort} className="w-32">{t('gapV2.soa.colResponsible')}</SortableTableHead>
                  <TableHead className="w-20 text-center">{t('gapV2.soa.colEvidence')}</TableHead>
                  <TableHead className="min-w-[200px]">{t('gapV2.soa.colJustification')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map(item => {
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
                          aria-label={t('gapV2.soa.selectItem', { code: item.codigo })}
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
                          {item.aplicavel ? t('gapV2.soa.yes') : t('gapV2.soa.no')}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge {...resolveConformityTone(statusKey)}>
                          {t(STATUS_LABEL_KEYS[statusKey]) || statusKey}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const riscos = riscosPorRequisito?.get(item.id) || [];
                          if (riscos.length === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <IconShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {t('riscosControles.soa.semRisco')}
                              </span>
                            );
                          }
                          return (
                            <span className="text-foreground/85" title={riscos.map(r => r.nome).join(', ')}>
                              {riscos.length} · {riscos.map(r => r.nome).join(', ')}
                            </span>
                          );
                        })()}
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
                          placeholder={!item.aplicavel ? t('gapV2.soa.placeholderExclusion') : t('gapV2.soa.placeholderObservations')}
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
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t('gapV2.soa.noResults')}
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
        onAssign={() => toast.info(t('gapV2.soa.comingSoonAssign'))}
        onSetDeadline={() => toast.info(t('gapV2.soa.comingSoonDeadline'))}
        onCreatePlan={() => toast.info(t('gapV2.soa.comingSoonPlan'))}
        onGenerateJustification={gerarJustificacoes}
      />
    </div>
  );
}
