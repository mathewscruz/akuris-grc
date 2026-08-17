import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Building2, AlertTriangle, Cpu } from 'lucide-react';
import { AkurisAIIcon } from '@/components/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { CHART_SERIES, CHART_GRID, CHART_AXIS } from '@/lib/chart-tokens';
// --- Catálogo único de funcionalidades/modelos de IA (src/lib/ai-usage-catalog.ts) ---
import {
  AI_MODELS,
  AI_FEATURES,
  featuresUsingModel,
  resolveAiFeature,
  aiFeatureLabel,
  type AiModelId,
} from '@/lib/ai-usage-catalog';

const MODEL_PRICING = AI_MODELS;

// funcionalidade (com ou sem sufixo ":acao") → id do modelo
function getModelForFunc(funcionalidade: string): AiModelId | null {
  return resolveAiFeature(funcionalidade)?.model ?? null;
}


// --- Interfaces ---

interface EmpresaFinanceiro {
  id: string;
  nome: string;
  plano_nome: string;
  receita_mensal: number;
  requisicoes: number;
  custo_estimado: number;
  margem: number;
  margem_percent: number;
  status: 'rentavel' | 'limite' | 'deficitario';
}

interface FeatureStats {
  funcionalidade: string;
  label: string;
  modelLabel: string;
  reqs: number;
  totalCostBRL: number;
  mapped: boolean;
}

interface ModelStats {
  model: string;
  label: string;
  provider: string;
  avgCostBRL: number;
  reqs: number;
  totalCostBRL: number;
}

export function FinanceiroIATab() {
  const { t, locale } = useLanguage();
  const [empresas, setEmpresas] = useState<EmpresaFinanceiro[]>([]);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideCost, setOverrideCost] = useState(0.05);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [avgCostPerReq, setAvgCostPerReq] = useState(0);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({});
  const [featureStats, setFeatureStats] = useState<FeatureStats[]>([]);

  useEffect(() => {
    fetchData();
  }, [overrideEnabled, overrideCost]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: empresasData, error: empErr } = await supabase
        .from('empresas')
        .select(`id, nome, creditos_consumidos, plano:planos(nome, creditos_franquia, preco_mensal)`)
        .order('nome');
      if (empErr) throw empErr;

      // Build plan prices dynamically from DB
      const pricesMap: Record<string, number> = { Free: 0 };
      (empresasData || []).forEach((e: any) => {
        if (e.plano?.nome) pricesMap[e.plano.nome] = Number(e.plano.preco_mensal) || 0;
      });
      setPlanPrices(pricesMap);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: consumoData, error: consErr } = await supabase
        .from('creditos_consumo')
        .select('empresa_id, funcionalidade')
        .gte('created_at', startOfMonth.toISOString());
      if (consErr) throw consErr;

      // Build model stats & per-empresa costs
      const modelReqCount: Record<string, number> = {};
      const reqCountByEmpresa: Record<string, { total: number; cost: number }> = {};
      const funcCount: Record<string, number> = {};

      (consumoData || []).forEach((c: any) => {
        const model = getModelForFunc(c.funcionalidade);
        const costPerReq = model ? MODEL_PRICING[model].avgCostPerReqBRL : 0.03;
        const modelKey = model || 'unknown';

        modelReqCount[modelKey] = (modelReqCount[modelKey] || 0) + 1;
        funcCount[c.funcionalidade] = (funcCount[c.funcionalidade] || 0) + 1;

        if (!reqCountByEmpresa[c.empresa_id]) reqCountByEmpresa[c.empresa_id] = { total: 0, cost: 0 };
        reqCountByEmpresa[c.empresa_id].total += 1;
        reqCountByEmpresa[c.empresa_id].cost += overrideEnabled ? overrideCost : costPerReq;
      });

      // Compute weighted avg cost
      const totalReqs = Object.values(reqCountByEmpresa).reduce((s, e) => s + e.total, 0);
      const totalCost = Object.values(reqCountByEmpresa).reduce((s, e) => s + e.cost, 0);
      const computedAvg = totalReqs > 0 ? totalCost / totalReqs : 0;
      setAvgCostPerReq(computedAvg);

      // Model stats
      const stats: ModelStats[] = Object.entries(MODEL_PRICING).map(([key, info]) => {
        const reqs = modelReqCount[key] || 0;
        return {
          model: key,
          label: info.label,
          provider: info.provider,
          avgCostBRL: info.avgCostPerReqBRL,
          reqs,
          totalCostBRL: reqs * info.avgCostPerReqBRL,
        };
      });
      setModelStats(stats);

      // Uso por funcionalidade (o que o utilizador vê como "consome IA")
      const feats: FeatureStats[] = Object.entries(funcCount)
        .map(([funcionalidade, reqs]) => {
          const feature = resolveAiFeature(funcionalidade);
          const model = feature ? MODEL_PRICING[feature.model] : null;
          const unit = overrideEnabled ? overrideCost : (model?.avgCostPerReqBRL ?? 0.03);
          return {
            funcionalidade,
            label: aiFeatureLabel(funcionalidade, locale),
            modelLabel: model?.label ?? t('configPlanos.financeiroIA.modeloDesconhecido'),
            reqs,
            totalCostBRL: reqs * unit,
            mapped: !!feature,
          };
        })
        .sort((a, b) => b.reqs - a.reqs);
      setFeatureStats(feats);

      // Empresas
      const mapped: EmpresaFinanceiro[] = (empresasData || []).map((e: any) => {
        const planoNome = e.plano?.nome || 'Free';
        const receita = pricesMap[planoNome] || 0;
        const empData = reqCountByEmpresa[e.id] || { total: 0, cost: 0 };
        const custo = empData.cost;
        const margem = receita - custo;
        const margemPct = receita > 0 ? (margem / receita) * 100 : (empData.total > 0 ? -100 : 0);
        let status: 'rentavel' | 'limite' | 'deficitario' = 'rentavel';
        if (margemPct < 10) status = 'limite';
        if (margem < 0) status = 'deficitario';

        return {
          id: e.id,
          nome: e.nome,
          plano_nome: planoNome,
          receita_mensal: receita,
          requisicoes: empData.total,
          custo_estimado: custo,
          margem,
          margem_percent: margemPct,
          status,
        };
      });

      setEmpresas(mapped);
    } catch (err) {
      console.error(err);
      toast.error(t('configPlanos.financeiroIA.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const receita = empresas.reduce((s, e) => s + e.receita_mensal, 0);
    const custo = empresas.reduce((s, e) => s + e.custo_estimado, 0);
    const reqs = empresas.reduce((s, e) => s + e.requisicoes, 0);
    return {
      receita,
      custo,
      margem: receita - custo,
      margemPct: receita > 0 ? ((receita - custo) / receita) * 100 : 0,
      totalReqs: reqs,
      deficitarios: empresas.filter(e => e.status === 'deficitario').length,
    };
  }, [empresas]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const payload = {
        receita_total: totals.receita,
        custo_total: totals.custo,
        margem_bruta: totals.margem,
        margem_percent: totals.margemPct,
        total_requisicoes: totals.totalReqs,
        custo_medio_por_req: avgCostPerReq,
        modelos_em_uso: modelStats.map(m => ({
          modelo: m.label,
          provider: m.provider,
          custo_medio_req: m.avgCostBRL,
          requisicoes: m.reqs,
          custo_total: m.totalCostBRL,
        })),
        empresas_deficitarias: empresas.filter(e => e.status === 'deficitario').map(e => ({
          nome: e.nome, plano: e.plano_nome, reqs: e.requisicoes, margem: e.margem
        })),
        planos: Object.entries(planPrices).map(([nome, preco]) => ({ nome, preco })),
        empresas_por_plano: Object.entries(
          empresas.reduce((acc, e) => { acc[e.plano_nome] = (acc[e.plano_nome] || 0) + 1; return acc; }, {} as Record<string, number>)
        ).map(([plano, qtd]) => ({ plano, qtd })),
      };

      const { data, error } = await supabase.functions.invoke('ai-module-assistant', {
        body: { action: 'pricing_analysis', data: payload },
      });

      if (error) throw error;
      if (data?.data) {
        const d = data.data;
        const parts: string[] = [];
        if (d.resumo) parts.push(`**${t('sweepConfig.financeiroIA.labelResumo')}:** ${d.resumo}`);
        if (d.diagnostico) parts.push(`**${t('sweepConfig.financeiroIA.labelDiagnostico')}:** ${d.diagnostico}`);
        if (d.recomendacoes?.length) {
          parts.push(`**${t('sweepConfig.financeiroIA.labelRecomendacoes')}:**`);
          d.recomendacoes.forEach((r: string, i: number) => parts.push(`${i + 1}. ${r}`));
        }
        if (d.alerta_empresas) parts.push(`**${t('sweepConfig.financeiroIA.labelAlertas')}:** ${d.alerta_empresas}`);
        if (d.conclusao) parts.push(`**${t('sweepConfig.financeiroIA.labelConclusao')}:** ${d.conclusao}`);
        setAiAnalysis(parts.join('\n\n') || JSON.stringify(d, null, 2));
      }
    } catch (err: any) {
      if (err?.message?.includes('402')) {
        toast.error(t('configPlanos.financeiroIA.creditosEsgotados'));
      } else {
        toast.error(t('configPlanos.financeiroIA.analiseError'));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      rentavel: { label: t('configPlanos.financeiroIA.statusRentavel'), variant: 'default' },
      limite: { label: t('configPlanos.financeiroIA.statusLimite'), variant: 'secondary' },
      deficitario: { label: t('configPlanos.financeiroIA.statusDeficitario'), variant: 'destructive' },
    };
    const s = map[status] || map.rentavel;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const columns = [
    { key: 'nome', label: t('configPlanos.financeiroIA.colEmpresa'), sortable: true, render: (v: string) => <span className="font-medium">{v}</span> },
    { key: 'plano_nome', label: t('configPlanos.financeiroIA.colPlano'), render: (v: string) => <Badge variant="outline">{v}</Badge> },
    { key: 'receita_mensal', label: t('configPlanos.financeiroIA.colReceitaMes'), sortable: true, render: (v: number) => `R$ ${v.toFixed(2)}` },
    { key: 'requisicoes', label: t('configPlanos.financeiroIA.colRequisicoes'), sortable: true },
    { key: 'custo_estimado', label: t('configPlanos.financeiroIA.colCustoEst'), sortable: true, render: (v: number) => `R$ ${v.toFixed(2)}` },
    {
      key: 'margem', label: t('configPlanos.financeiroIA.colMargem'), sortable: true, render: (v: number, row: EmpresaFinanceiro) => (
        <span className={v < 0 ? 'text-destructive font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
          R$ {v.toFixed(2)} ({row.margem_percent.toFixed(0)}%)
        </span>
      )
    },
    { key: 'status', label: t('configPlanos.financeiroIA.colStatus'), render: (v: string) => statusBadge(v) },
  ];

  // Envio 9: paleta neutra partilhada — nada de roxo nem hex/HSL cru.
  const CHART_COLORS = CHART_SERIES;

  return (
    <div className="space-y-6">
      {/* Card: Modelos IA em Uso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            {t('configPlanos.financeiroIA.modelosTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colModelo')}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colProvider')}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colInputTokens')}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colOutputTokens')}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colCustoMedioReq')}</th>
                  <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colFuncoes')}</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">{t('configPlanos.financeiroIA.colReqsMes')}</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">{t('configPlanos.financeiroIA.colCustoTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([key, info]) => {
                  const stat = modelStats.find(m => m.model === key);
                  const feats = featuresUsingModel(key as AiModelId);
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-2 font-medium">
                        {info.label}
                        {info.fallbackOnly && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">fallback</span>
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">{info.provider}</Badge>
                      </td>
                      <td className="py-2 font-mono text-xs">${info.inputPer1kTokens.toFixed(5)}</td>
                      <td className="py-2 font-mono text-xs">${info.outputPer1kTokens.toFixed(4)}</td>
                      <td className="py-2 font-mono text-xs">R$ {info.avgCostPerReqBRL.toFixed(3)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {feats.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : feats.map(f => (
                            <Badge key={f.key} variant="secondary" className="text-[10px]">
                              {aiFeatureLabel(f.key, locale)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 text-right font-semibold">{stat?.reqs || 0}</td>
                      <td className="py-2 text-right font-semibold">R$ {(stat?.totalCostBRL || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}

              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={4} className="pt-2">{t('configPlanos.financeiroIA.custoMedioPonderado')}</td>
                  <td className="pt-2 font-mono">R$ {avgCostPerReq.toFixed(3)}</td>
                  <td></td>
                  <td className="pt-2 text-right">{totals.totalReqs}</td>
                  <td className="pt-2 text-right">R$ {totals.custo.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Override toggle */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Switch checked={overrideEnabled} onCheckedChange={setOverrideEnabled} id="override" />
              <Label htmlFor="override" className="text-xs text-muted-foreground">{t('configPlanos.financeiroIA.simularCustoFixo')}</Label>
            </div>
            {overrideEnabled && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">R$</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={overrideCost}
                  onChange={(e) => setOverrideCost(parseFloat(e.target.value) || 0.05)}
                  className="w-24 h-8 text-xs"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Consumo por funcionalidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('configPlanos.financeiroIA.funcionalidadesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {featureStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('configPlanos.financeiroIA.funcionalidadesVazio')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colFuncionalidade')}</th>
                    <th className="pb-2 font-medium text-muted-foreground">{t('configPlanos.financeiroIA.colFuncionalidadeModelo')}</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">{t('configPlanos.financeiroIA.colReqsMes')}</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">{t('configPlanos.financeiroIA.colCustoTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {featureStats.map((f) => (
                    <tr key={f.funcionalidade} className="border-b border-border/50">
                      <td className="py-2">
                        <span className="font-medium">{f.label}</span>
                        {!f.mapped && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {t('configPlanos.financeiroIA.funcionalidadeNaoMapeada')}
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">{f.modelLabel}</Badge>
                      </td>
                      <td className="py-2 text-right font-semibold">{f.reqs}</td>
                      <td className="py-2 text-right font-semibold">R$ {f.totalCostBRL.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('configPlanos.financeiroIA.statReceitaTotal')}
          value={`R$ ${totals.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          description={t('configPlanos.financeiroIA.statReceitaTotalDesc', { count: empresas.filter(e => e.receita_mensal > 0).length })}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title={t('configPlanos.financeiroIA.statCustoEstimado')}
          value={`R$ ${totals.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          description={t('configPlanos.financeiroIA.statCustoEstimadoDesc', { reqs: totals.totalReqs, media: avgCostPerReq.toFixed(3) })}
          icon={<AkurisAIIcon className="h-4 w-4" />}
        />
        <StatCard
          title={t('configPlanos.financeiroIA.statMargemBruta')}
          value={`R$ ${totals.margem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          description={t('configPlanos.financeiroIA.statMargemBrutaDesc', { percent: totals.margemPct.toFixed(1) })}
          icon={totals.margem >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          title={t('configPlanos.financeiroIA.statEmpresasDeficit')}
          value={totals.deficitarios}
          description={totals.deficitarios > 0 ? t('configPlanos.financeiroIA.statEmpresasDeficitAtencao') : t('configPlanos.financeiroIA.statEmpresasDeficitOk')}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      {/* Tabela rentabilidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('configPlanos.financeiroIA.rentabilidadeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={empresas}
            columns={columns}
            loading={loading}
            searchPlaceholder={t('configPlanos.financeiroIA.searchPlaceholder')}
            paginated
            emptyState={{
              icon: <Building2 className="h-8 w-8" />,
              title: t('configPlanos.financeiroIA.emptyTitle'),
              description: t('configPlanos.financeiroIA.emptyDescription'),
            }}
          />
        </CardContent>
      </Card>

      {/* Gráfico consumo por modelo */}
      {modelStats.some(m => m.reqs > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('configPlanos.financeiroIA.chartTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelStats.filter(m => m.reqs > 0)} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis type="number" stroke={CHART_AXIS} tick={{ fontSize: 12, fill: CHART_AXIS }} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={160}
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'reqs') return [`${value} ${t('configPlanos.financeiroIA.tooltipRequisicoes')}`, t('configPlanos.financeiroIA.tooltipRequisicoesLabel')];
                      return [`R$ ${value.toFixed(2)}`, t('configPlanos.financeiroIA.tooltipCustoLabel')];
                    }}
                  />
                  <Bar dataKey="reqs" radius={[0, 4, 4, 0]}>
                    {modelStats.filter(m => m.reqs > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AkurisAIIcon className="h-5 w-5" />
            {t('configPlanos.financeiroIA.analiseTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleAIAnalysis} disabled={aiLoading || loading}>
            {aiLoading ? <AkurisPulse size={16} className="mr-2" /> : <AkurisAIIcon className="h-4 w-4 mr-2" />}
            {aiLoading ? t('configPlanos.financeiroIA.analisando') : t('configPlanos.financeiroIA.gerarAnalise')}
          </Button>

          {aiAnalysis && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm leading-relaxed whitespace-pre-line">
              {aiAnalysis.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.includes(':**')) {
                  const [label, ...rest] = line.split(':**');
                  return (
                    <p key={i}>
                      <strong>{label.replace(/\*\*/g, '')}:</strong> {rest.join(':**').replace(/\*\*/g, '')}
                    </p>
                  );
                }
                if (line.match(/^\d+\./)) return <p key={i} className="pl-4">{line}</p>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i}>{line.replace(/\*\*/g, '')}</p>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
