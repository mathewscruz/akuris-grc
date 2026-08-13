import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface FrameworkRow {
  id: string;
  nome: string;
  total: number;
  traduzidos: number;
  /** Requisitos com orientação (guidance) já salva em inglês. */
  guidanceEn: number;
}

/**
 * Painel super-admin: traduz para inglês o conteúdo dos requisitos dos
 * frameworks globais do Gap Analysis (colunas *_en), em lotes.
 */
export function TraducaoFrameworksTab() {
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
        const [{ count: total }, { count: pendentes }, { count: guidancePendente }] = await Promise.all([
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
            .is('orientacao_implementacao_en', null),
        ]);
        result.push({
          id: fw.id,
          nome: fw.nome,
          total: total ?? 0,
          traduzidos: Math.max((total ?? 0) - (pendentes ?? 0), 0),
          guidanceEn: Math.max((total ?? 0) - (guidancePendente ?? 0), 0),
        });
      }
      setRows(result);
    } catch (e) {
      logger.error('Erro ao carregar frameworks para tradução', e);
      toast.error('Não foi possível carregar os frameworks.');
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
      toast.success(`Tradução concluída: ${fw.nome}`);
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
      <p className="text-sm text-muted-foreground">
        Traduz para inglês títulos, descrições, categorias e textos de apoio dos requisitos.
        O conteúdo em português continua como base — o inglês é exibido apenas quando o idioma
        ativo é EN. {pendentesTotais} requisito(s) pendente(s).
      </p>

      <div className="space-y-3">
        {rows.map((fw) => {
          const pct = fw.total ? Math.round((fw.traduzidos / fw.total) * 100) : 0;
          const running = runningId === fw.id;
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
                  <span className="text-xs text-muted-foreground">
                    {fw.traduzidos} de {fw.total} requisitos
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={pct === 100 ? 'outline' : 'default'}
                  disabled={!!runningId || fw.total === 0 || pct === 100}
                  onClick={() => traduzir(fw)}
                >
                  {running ? 'Traduzindo…' : pct === 100 ? 'Traduzido' : 'Traduzir para EN'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default TraducaoFrameworksTab;
