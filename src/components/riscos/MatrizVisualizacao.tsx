import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Grid3X3 } from 'lucide-react';

interface Matriz {
  id: string;
  nome: string;
  configuracao?: {
    escala_probabilidade: Array<{ valor: number; descricao: string }>;
    escala_impacto: Array<{ valor: number; descricao: string }>;
    niveis_risco: Array<{ min: number; max: number; nivel: string; cor?: string }>;
    metodo_calculo?: string;
  };
}

interface Risco {
  id: string;
  nome: string;
  probabilidade_inicial: string;
  impacto_inicial: string;
  nivel_risco_inicial: string;
}

interface Props {
  onNavigate?: () => void;
  onConfigure?: () => void;
}

export function MatrizVisualizacao({ onNavigate, onConfigure }: Props) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [matriz, setMatriz] = useState<Matriz | null>(null);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.empresa_id) {
      fetchMatrizAndRiscos();
    }
  }, [profile?.empresa_id]);

  const fetchMatrizAndRiscos = async () => {
    try {
      const { data: matrizData } = await supabase
        .from('riscos_matrizes')
        .select(`
          id,
          nome,
          configuracao:riscos_matriz_configuracao(
            escala_probabilidade,
            escala_impacto,
            niveis_risco,
            metodo_calculo
          )
        `)
        .eq('empresa_id', profile?.empresa_id)
        .limit(1)
        .single();

      if (matrizData && matrizData.configuracao && matrizData.configuracao[0]) {
        setMatriz({
          ...matrizData,
          configuracao: {
            escala_probabilidade: matrizData.configuracao[0].escala_probabilidade as Array<{ valor: number; descricao: string }>,
            escala_impacto: matrizData.configuracao[0].escala_impacto as Array<{ valor: number; descricao: string }>,
            niveis_risco: matrizData.configuracao[0].niveis_risco as Array<{ min: number; max: number; nivel: string; cor?: string }>,
            metodo_calculo: matrizData.configuracao[0].metodo_calculo || 'multiplicacao'
          }
        });
      }

      const { data: riscosData } = await supabase
        .from('riscos')
        .select('id, nome, probabilidade_inicial, impacto_inicial, nivel_risco_inicial')
        .eq('empresa_id', profile?.empresa_id);

      setRiscos(riscosData || []);
    } catch (error) {
      logger.error('Erro ao carregar matriz e riscos:', { data: error });
    } finally {
      setLoading(false);
    }
  };

  const getRiscosPorCelula = (probabilidade: number, impacto: number) => {
    return riscos.filter(risco => {
      const probRisco = parseInt(risco.probabilidade_inicial);
      const impactoRisco = parseInt(risco.impacto_inicial);
      return probRisco === probabilidade && impactoRisco === impacto;
    });
  };

  const getNivelRisco = (probabilidade: number, impacto: number) => {
    if (!matriz?.configuracao) return null;
    const metodoCalculo = (matriz.configuracao as any).metodo_calculo || 'multiplicacao';
    const resultado = metodoCalculo === 'multiplicacao'
      ? probabilidade * impacto
      : probabilidade + impacto;
    return matriz.configuracao.niveis_risco.find(n =>
      resultado >= n.min && resultado <= n.max
    );
  };

  const getCorNivel = (nivel: string) => {
    if (!matriz?.configuracao) return '#6b7280';
    const nivelConfig = matriz.configuracao.niveis_risco.find(n => n.nivel === nivel);
    return nivelConfig?.cor || '#6b7280';
  };

  const handleCellClick = (riscosNaCelula: Risco[]) => {
    if (riscosNaCelula.length > 0) {
      const riscosIds = riscosNaCelula.map(r => r.id).join(',');
      navigate(`/riscos?ids=${riscosIds}`);
      onNavigate?.();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!matriz) {
    return (
      <EmptyState
        icon={<Grid3X3 className="h-10 w-10" strokeWidth={1.5} />}
        title="Nenhuma matriz configurada"
        description="Configure uma matriz de risco para visualizar a distribuição dos seus riscos por probabilidade e impacto."
        action={onConfigure ? { label: 'Configurar agora', onClick: onConfigure } : undefined}
      />
    );
  }

  const escalaProbabilidade = matriz.configuracao?.escala_probabilidade || [];
  const escalaImpacto = matriz.configuracao?.escala_impacto || [];
  const niveis = matriz.configuracao?.niveis_risco || [];
  const metodo = (matriz.configuracao as any)?.metodo_calculo || 'multiplicacao';
  const metodoLabel = metodo === 'multiplicacao' ? 'P × I' : 'P + I';
  const totalPlotados = riscos.filter(r => r.probabilidade_inicial && r.impacto_inicial).length;

  const escalaProbabilidadeReversed = [...escalaProbabilidade].reverse();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Header editorial */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Matriz Visual
            </span>
            <h3 className="text-base font-semibold text-foreground">
              {matriz.nome}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              Cálculo: <span className="text-foreground">{metodoLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              {totalPlotados} risco{totalPlotados === 1 ? '' : 's'} plotado{totalPlotados === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Matriz */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex gap-3 max-w-3xl mx-auto">
            {/* Eixo Y label */}
            <div className="flex items-center justify-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium [writing-mode:vertical-rl] rotate-180">
                Probabilidade ↑
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Cabeçalho impacto */}
              <div
                className="grid gap-1 mb-1"
                style={{ gridTemplateColumns: `48px repeat(${escalaImpacto.length}, minmax(0, 1fr))` }}
              >
                <div className="p-1.5 text-xs font-semibold text-center text-muted-foreground">
                  P\I
                </div>
                {escalaImpacto.map((impacto) => (
                  <div
                    key={impacto.valor}
                    className="p-2 text-center text-xs font-semibold bg-muted/60 rounded text-foreground"
                    title={impacto.descricao}
                  >
                    {impacto.valor}
                  </div>
                ))}
              </div>

              {/* Linhas */}
              {escalaProbabilidadeReversed.map((probabilidade) => (
                <div
                  key={probabilidade.valor}
                  className="grid gap-1 mb-1"
                  style={{ gridTemplateColumns: `48px repeat(${escalaImpacto.length}, minmax(0, 1fr))` }}
                >
                  <div
                    className="p-2 text-xs font-semibold bg-muted/60 rounded flex items-center justify-center text-foreground"
                    title={probabilidade.descricao}
                  >
                    {probabilidade.valor}
                  </div>
                  {escalaImpacto.map((impacto) => {
                    const riscosNaCelula = getRiscosPorCelula(probabilidade.valor, impacto.valor);
                    const nivelRisco = getNivelRisco(probabilidade.valor, impacto.valor);
                    const cor = nivelRisco ? getCorNivel(nivelRisco.nivel) : '#9ca3af';
                    const resultado = metodo === 'multiplicacao'
                      ? probabilidade.valor * impacto.valor
                      : probabilidade.valor + impacto.valor;

                    const cellInner = (
                      <div
                        onClick={() => handleCellClick(riscosNaCelula)}
                        className={`relative p-1.5 border border-border/60 rounded min-h-[64px] flex flex-col items-center justify-center gap-1 aspect-square transition-all ${
                          riscosNaCelula.length > 0
                            ? 'cursor-pointer hover:scale-[1.04] hover:shadow-md hover:border-foreground/20'
                            : ''
                        }`}
                        style={{ backgroundColor: cor + '22' }}
                      >
                        {nivelRisco && (
                          <div
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold leading-none text-white shadow-sm"
                            style={{ backgroundColor: cor }}
                          >
                            {nivelRisco.nivel.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {riscosNaCelula.length > 0 && (
                          <div
                            className="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: cor }}
                          >
                            {riscosNaCelula.length}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <Tooltip key={`${probabilidade.valor}-${impacto.valor}`}>
                        <TooltipTrigger asChild>{cellInner}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              {nivelRisco && (
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: cor }}
                                />
                              )}
                              <span className="font-semibold">
                                {nivelRisco?.nivel || 'Sem nível'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              P {probabilidade.valor} {metodo === 'multiplicacao' ? '×' : '+'} I {impacto.valor} = <span className="text-foreground font-medium">{resultado}</span>
                            </div>
                            {riscosNaCelula.length > 0 ? (
                              <div className="pt-1 border-t border-border/60 space-y-0.5">
                                {riscosNaCelula.slice(0, 3).map(r => (
                                  <div key={r.id} className="text-xs truncate">• {r.nome}</div>
                                ))}
                                {riscosNaCelula.length > 3 && (
                                  <div className="text-xs text-primary font-medium pt-0.5">
                                    + {riscosNaCelula.length - 3} outros — clique para ver todos
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Sem riscos nesta célula</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}

              {/* Eixo X label */}
              <div className="text-center mt-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Impacto →
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Legenda dos níveis */}
        {niveis.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mr-1">
              Níveis
            </span>
            {niveis.map((n, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: n.cor || '#6b7280' }}
                />
                <span className="text-foreground">{n.nivel || `Nível ${i + 1}`}</span>
                <span className="text-muted-foreground">({n.min}–{n.max})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
