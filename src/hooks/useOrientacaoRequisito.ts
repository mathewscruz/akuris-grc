/**
 * A orientação de um requisito, igual nos dois sítios onde ela aparece.
 *
 * O produto tem duas superfícies para trabalhar um requisito: a gaveta lateral
 * (triagem rápida, que é para onde a fila de prioridades manda toda a gente) e
 * o diálogo completo. Só o diálogo pedia a orientação ao servidor. A gaveta
 * mostrava o que já estivesse gravado e, não estando, caía no texto da norma
 * sob o rótulo "O QUE A NORMA EXIGE" — sem nunca tentar buscar coisa melhor.
 *
 * Como 98% dos requisitos não têm orientação gravada, quem seguia o caminho
 * recomendado pelo produto nunca via orientação nenhuma. O caminho principal
 * era o único sem a peça principal.
 *
 * Este hook é a conta única. Ambas as superfícies passam a pedir, a gerar, a
 * falhar e a explicar-se da mesma maneira.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { statusDeErroDeFuncao } from '@/lib/edge-function-utils';
import { localizeRequirement } from '@/lib/gap-i18n';
import { getAppLocale } from '@/lib/i18n-locale';
import { logger } from '@/lib/logger';

export interface PerguntaDiagnostico {
  pergunta: string;
  peso: number;
}

/** Em que pé está a orientação deste requisito. */
export type EstadoOrientacao =
  /** Há texto para mostrar. */
  | 'ok'
  /** A pedir ao servidor; mostra esqueleto. */
  | 'gerando'
  /** Não há, e não houve erro — simplesmente ainda não foi escrita. */
  | 'indisponivel'
  /** A geração falhou por uma razão qualquer que não crédito. */
  | 'falha'
  /** A conta ficou sem créditos de IA. */
  | 'creditos';

export interface Orientacao {
  texto: string | null;
  evidencias: string | null;
  perguntas: PerguntaDiagnostico[];
  estado: EstadoOrientacao;
  /** Pede de novo. `forcar` só é permitido a super-admin pelo lado do servidor. */
  gerar: (forcar?: boolean) => Promise<void>;
}

const perguntasDe = (bruto: string | null | undefined): PerguntaDiagnostico[] => {
  if (!bruto) return [];
  try {
    const parsed = JSON.parse(bruto);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function useOrientacaoRequisito(requirementId: string | null, ativo = true): Orientacao {
  const [texto, setTexto] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<string | null>(null);
  const [perguntas, setPerguntas] = useState<PerguntaDiagnostico[]>([]);
  const [estado, setEstado] = useState<EstadoOrientacao>('indisponivel');
  // Uma geração automática por requisito e por montagem: sem isto, um requisito
  // sem orientação dispara a função a cada render que mude a dependência.
  const jaPediu = useRef<string | null>(null);

  const gerar = useCallback(async (forcar = false) => {
    if (!requirementId) return;
    setEstado('gerando');
    try {
      const { data, error } = await supabase.functions.invoke('populate-requirement-guidance', {
        // O conteúdo é global e por idioma: a função devolve o texto já gravado
        // quando existir, sem consumir crédito.
        body: { requirement_id: requirementId, locale: getAppLocale(), force: forcar },
      });
      if (error) throw error;
      if (data?.orientacao_implementacao) {
        setTexto(data.orientacao_implementacao);
        setEvidencias(data.exemplos_evidencias || null);
        setPerguntas(perguntasDe(data.perguntas_diagnostico));
        setEstado('ok');
      } else {
        setEstado('indisponivel');
      }
    } catch (error: unknown) {
      logger.error('Erro ao gerar orientação de requisito', {
        error: error instanceof Error ? error.message : String(error),
      });
      // O 402 chega em `error.context.status`, não em `error.status`: o
      // supabase-js embrulha a resposta num FunctionsHttpError.
      const status = statusDeErroDeFuncao(error);
      const semCredito = status === 402 || (error as any)?.message?.includes('402');
      setEstado(semCredito ? 'creditos' : 'falha');
    }
  }, [requirementId]);

  useEffect(() => {
    if (!requirementId || !ativo) return;
    let cancelado = false;

    (async () => {
      const { data, error } = await supabase
        .from('gap_analysis_requirements')
        .select('orientacao_implementacao, exemplos_evidencias, perguntas_diagnostico, orientacao_implementacao_en, exemplos_evidencias_en, perguntas_diagnostico_en')
        .eq('id', requirementId)
        .single();
      if (cancelado) return;
      if (error) {
        setEstado('falha');
        return;
      }

      const bruto = (data || {}) as Record<string, string | null>;
      // Conteúdo bilíngue: mostra a versão do idioma actual e, não havendo,
      // a portuguesa, enquanto a do idioma é gerada em segundo plano.
      const local = localizeRequirement(bruto as any) as Record<string, string | null>;
      setTexto(local.orientacao_implementacao || null);
      setEvidencias(local.exemplos_evidencias || null);
      setPerguntas(perguntasDe(local.perguntas_diagnostico));
      setEstado(local.orientacao_implementacao ? 'ok' : 'indisponivel');

      const colunaDoIdioma = getAppLocale() === 'en' ? 'orientacao_implementacao_en' : 'orientacao_implementacao';
      if (!(bruto[colunaDoIdioma] || '').trim() && jaPediu.current !== requirementId) {
        jaPediu.current = requirementId;
        void gerar(false);
      }
    })();

    return () => { cancelado = true; };
  }, [requirementId, ativo, gerar]);

  return { texto, evidencias, perguntas, estado, gerar };
}
