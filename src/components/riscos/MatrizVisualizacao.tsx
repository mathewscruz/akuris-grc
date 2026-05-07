
import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
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

export function MatrizVisualizacao() {
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
      // Buscar primeira matriz disponível da empresa
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

      // Buscar riscos da empresa
      const { data: riscosData } = await supabase
        .from('riscos')
        .select('id, nome, probabilidade_inicial, impacto_inicial, nivel_risco_inicial')
        .eq('empresa_id', profile?.empresa_id);

      setRiscos(riscosData || []);
    } catch (error) {
      logger.error('Erro ao carregar matriz e riscos:', error);
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
      // Navegar para a página de riscos com filtro dos IDs
      const riscosIds = riscosNaCelula.map(r => r.id).join(',');
      navigate(`/riscos?ids=${riscosIds}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matriz de Risco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <AkurisPulse size={32} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!matriz) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Matriz de Risco</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma matriz de risco configurada. Configure uma matriz no módulo de riscos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const escalaProbabilidade = matriz.configuracao?.escala_probabilidade || [];
  const escalaImpacto = matriz.configuracao?.escala_impacto || [];
  
  // Criar cópia do array antes de reverter para não mutar o original
  const escalaProbabilidadeReversed = [...escalaProbabilidade].reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Matriz de Risco - {matriz.nome}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="w-full max-w-md mx-auto">
          {/* Cabeçalho da matriz */}
          <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `40px repeat(${escalaImpacto.length}, minmax(0, 1fr))` }}>
            <div className="p-1 font-medium text-[10px] text-center">Prob.</div>
            {escalaImpacto.map((impacto) => (
              <div key={impacto.valor} className="p-1 text-center font-medium text-[10px] bg-muted rounded">
                {impacto.valor}
              </div>
            ))}
          </div>

          {/* Linhas da matriz */}
          {escalaProbabilidadeReversed.map((probabilidade) => (
            <div key={probabilidade.valor} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `40px repeat(${escalaImpacto.length}, minmax(0, 1fr))` }}>
              <div className="p-1 font-medium text-[10px] bg-muted rounded flex items-center justify-center">
                {probabilidade.valor}
              </div>
              {escalaImpacto.map((impacto) => {
                const riscosNaCelula = getRiscosPorCelula(probabilidade.valor, impacto.valor);
                const nivelRisco = getNivelRisco(probabilidade.valor, impacto.valor);
                const cor = nivelRisco ? getCorNivel(nivelRisco.nivel) : '#f3f4f6';
                
                return (
                  <div 
                    key={`${probabilidade.valor}-${impacto.valor}`}
                    onClick={() => handleCellClick(riscosNaCelula)}
                    className={`p-0.5 border border-border rounded min-h-[40px] flex flex-col items-center justify-center relative aspect-square transition-all ${
                      riscosNaCelula.length > 0 ? 'cursor-pointer hover:opacity-80 hover:scale-105 hover:shadow-md' : ''
                    }`}
                    style={{ backgroundColor: cor + '20' }}
                    title={riscosNaCelula.length > 0 ? `Clique para ver ${riscosNaCelula.length} risco(s)` : ''}
                  >
                    {nivelRisco && (
                      <Badge 
                        className="text-[9px] mb-0.5 px-0.5 py-0 h-auto leading-tight" 
                        style={{ backgroundColor: cor, color: 'white', borderColor: cor }}
                      >
                        {nivelRisco.nivel.charAt(0)}
                      </Badge>
                    )}
                    {riscosNaCelula.length > 0 && (
                      <div 
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ backgroundColor: cor }}
                      >
                        {riscosNaCelula.length}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Legenda do eixo Y */}
          <div className="text-center mt-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Impacto →</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
