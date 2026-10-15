import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

interface FrameworkRow {
  id: string;
  nome: string;
  total: number;
  traduzidos: number;
  /**
   * Requisitos com orientação já escrita, por idioma.
   *
   * Só existia `guidanceEn`, e o botão gerava só inglês. A orientação é a peça
   * que substitui a consultoria — «o que é este requisito e o que faço» — e o
   * mercado deste produto lê português. Resultado medido: das 1.573
   * orientações, 36 estão semeadas no repositório (2,3%) e a única ferramenta
   * de produção em massa aquecia a língua que o cliente brasileiro não lê.
   */
  guidancePt: number;
  guidanceEn: number;
}

/**
 * Painel super-admin: traduz para inglês o conteúdo dos requisitos dos
 * frameworks globais do Gap Analysis (colunas *_en), em lotes.
 */
export function TraducaoFrameworksTab() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FrameworkRow[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: frameworks, error } = await supabase
        .from('gap_analysis_frameworks')
        .select('id, nome')
        .is('empresa_id', null)
        .order('nome');
      if (error) throw error;

      const result: FrameworkRow[] = [];
      for (const fw of frameworks || []) {
        const [{ count: total }, { count: pendentes }, { count: pendentePt }, { count: pendenteEn }] = await Promise.all([
          supabase
            .from('gap_analysis_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('framework_id', fw.id),
          supabase
            .from('gap_analysis_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('framework_id', fw.id)
            .or('titulo_en.is.null,descricao_en.is.null'),
          supabase
            .from('gap_analysis_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('framework_id', fw.id)
            .is('orientacao_implementacao', null),
          supabase
            .from('gap_analysis_requirements')
            .select('id', { count: 'exact', head: true })
            .eq('framework_id', fw.id)
            .is('orientacao_implementacao_en', null),
        ]);
        result.push({
          id: fw.id,
          nome: fw.nome,
          total: total ?? 0,
          traduzidos: Math.max((total ?? 0) - (pendentes ?? 0), 0),
          guidancePt: Math.max((total ?? 0) - (pendentePt ?? 0), 0),
          guidanceEn: Math.max((total ?? 0) - (pendenteEn ?? 0), 0),
        });
      }
      setRows(result);
    } catch (e) {
      logger.error('Erro ao carregar frameworks para tradução', e);
      toast.error(t('cardsKpi.sweep.gap.erroCarregarFrameworks'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const traduzir = async (fw: FrameworkRow) => {
    setRunningId(fw.id);
    let guard = 0;
    try {
      // Processa em lotes até zerar as pendências (guard evita laço infinito).
      while (guard < 60) {
        guard++;
        const res = await invokeEdgeFunction<{ translated: number; remaining: number; done: boolean }>(
          'translate-framework-content',
          { body: { frameworkId: fw.id }, isAiCall: true },
        );
        if (res.error || !res.data) break;
        setRows((prev) =>
          prev.map((r) =>
            r.id === fw.id ? { ...r, traduzidos: Math.max(r.total - res.data.remaining, 0) } : r,
          ),
        );
        if (res.data.done || res.data.translated === 0) break;
      }
      toast.success(t('sweepConfig.traducaoFrameworks.toastTranslateDone', { nome: fw.nome }));
    } finally {
      setRunningId(null);
      load();
    }
  };

  /**
   * Gera em lote as orientações de um framework, **nas duas línguas**.
   *
   * Passava `locale: 'en'` cravado. A orientação é o que o produto vende — quem
   * nunca viu a norma abre o requisito e lê o que fazer — e ela nasce vazia:
   * o catálogo traz 36 de 1.573 escritas. As restantes só existem quando
   * alguém abre aquele requisito, espera pelo modelo e gasta um crédito DA
   * EMPRESA. Este painel era o único sítio onde isso se podia pagar de uma vez,
   * centralmente, e aquecia só o inglês.
   *
   * Português primeiro: é a língua do mercado, e é também a base a partir da
   * qual o inglês é escrito (`basePt` na função de borda).
   */
  /** Gera as orientações em falta de um framework, PT e depois EN. Devolve se ficou completo. */
  const [atual, setAtual] = useState<{ id: string; locale: 'pt' | 'en' } | null>(null);
  const prepararFramework = async (fw: FrameworkRow): Promise<boolean> => {
    let complete = true;
    for (const locale of ['pt', 'en'] as const) {
      setAtual({ id: fw.id, locale });
      let offset = 0, passes = 0, guard = 0;
      while (guard++ < 200) {
        const res = await invokeEdgeFunction<{ processed: number; failed: number; pending: number; remaining: number; total: number }>(
          'populate-requirement-guidance',
          { body: { framework_id: fw.id, locale, batch_size: 4, offset } },
        );
        if (res.error || !res.data) {
          complete = false;
          toast.error(`${fw.nome} (${locale.toUpperCase()}): ${res.error?.message || t('experience.guidanceBatchIncomplete')}`);
          break;
        }
        const d = res.data;
        const feitos = Math.max(fw.total - (d.remaining ?? 0), 0);
        setRows((prev) => prev.map((r) => r.id === fw.id ? { ...r, ...(locale === 'pt' ? { guidancePt: feitos } : { guidanceEn: feitos }) } : r));
        if ((d.remaining ?? 0) === 0) break;
        // Itens que falharam ou estão a meio ficam para trás; segue para os seguintes.
        offset += (d.failed ?? 0) + (d.pending ?? 0);
        if (d.total === 0 || offset >= (d.remaining ?? 0)) {
          if (++passes >= 3) { complete = false; break; }
          offset = 0;
          await new Promise((r) => setTimeout(r, 15_000));
        }
      }
    }
    setAtual(null);
    return complete;
  };

  const traduzirOrientacoes = async (fw: FrameworkRow) => {
    setRunningId(`guidance-${fw.id}`);
    try {
      if (await prepararFramework(fw)) toast.success(t('sweepConfig.traducaoFrameworks.toastGuidanceDone', { nome: fw.nome }));
      else toast.error(t('experience.guidanceBatchIncomplete'));
    } finally {
      setRunningId(null);
      load();
    }
  };

  const prepararTodos = async () => {
    setRunningId('guidance-all');
    toast.info(t('sweepConfig.traducaoFrameworks.btnGenerating'));
    let ok = true;
    try {
      for (const fw of rows) {
        if (fw.total === 0 || (fw.guidancePt >= fw.total && fw.guidanceEn >= fw.total)) continue;
        if (!(await prepararFramework(fw))) ok = false;
      }
      if (ok) toast.success(t('sweepConfig.traducaoFrameworks.toastGuidanceAll'));
      else toast.error(t('experience.guidanceBatchIncomplete'));
    } finally {
      setRunningId(null);
      load();
    }
  };

  const pendentesTotais = useMemo(
    () => rows.reduce((acc, r) => acc + (r.total - r.traduzidos), 0),
    [rows],
  );


  if (loading) return <AkurisPulse />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('sweepConfig.traducaoFrameworks.guidanceAllHint')}</p>
        <Button size="sm" disabled={!!runningId} onClick={prepararTodos} className="shrink-0">
          {runningId === 'guidance-all' ? <><AkurisPulse size={16} /> {t('sweepConfig.traducaoFrameworks.btnGenerating')}</> : t('sweepConfig.traducaoFrameworks.btnGuidanceAll')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('sweepConfig.traducaoFrameworks.intro')} {t('sweepConfig.traducaoFrameworks.pendingCount', { count: String(pendentesTotais) })}
      </p>

      <div className="space-y-3">
        {rows.map((fw) => {
          const pct = fw.total ? Math.round((fw.traduzidos / fw.total) * 100) : 0;
          /* O botão só está «pronto» quando as DUAS línguas estão escritas:
             com o português a zero, o cliente continua a pagar requisito a
             requisito, que era exactamente o problema. */
          const pctGuidance = fw.total
            ? Math.round((Math.min(fw.guidancePt, fw.guidanceEn) / fw.total) * 100)
            : 0;
          const running = runningId === fw.id;
          const runningGuidance = atual?.id === fw.id;
          return (
            <Card key={fw.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{fw.nome}</span>
                    <StatusBadge tone={pct === 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'}>
                      {pct}%
                    </StatusBadge>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <Progress value={pctGuidance} className="h-1.5" />
                  {runningGuidance && (
                    <span className="flex items-center gap-2 text-xs font-medium text-primary">
                      <AkurisPulse size={14} /> {t('sweepConfig.traducaoFrameworks.btnGenerating')} ({atual!.locale.toUpperCase()}) — PT {fw.guidancePt}/{fw.total} · EN {fw.guidanceEn}/{fw.total}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t('sweepConfig.traducaoFrameworks.progressLine', { traduzidos: String(fw.traduzidos), total: String(fw.total), guidancePt: String(fw.guidancePt), guidanceEn: String(fw.guidanceEn) })}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    variant={pct === 100 ? 'outline' : 'default'}
                    disabled={!!runningId || fw.total === 0 || pct === 100}
                    onClick={() => traduzir(fw)}
                  >
                    {running ? t('sweepConfig.traducaoFrameworks.btnTranslating') : pct === 100 ? t('sweepConfig.traducaoFrameworks.btnTranslated') : t('sweepConfig.traducaoFrameworks.btnTranslate')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!runningId || fw.total === 0 || pctGuidance === 100}
                    onClick={() => traduzirOrientacoes(fw)}
                  >
                    {runningGuidance
                      ? t('sweepConfig.traducaoFrameworks.btnGenerating')
                      : pctGuidance === 100
                        ? t('sweepConfig.traducaoFrameworks.btnGuidanceOk')
                        : t('sweepConfig.traducaoFrameworks.btnGuidanceTranslate')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
