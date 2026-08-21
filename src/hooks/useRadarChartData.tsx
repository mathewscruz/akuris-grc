import { useMemo } from "react";
import { useAtivosStats } from "./useAtivosStats";
import { useControlesStats } from "./useControlesStats";
import { useIncidentesStats } from "./useIncidentesStats";
import { useRiscosStats } from "./useRiscosStats";
import { useGapAnalysisStats } from "./useGapAnalysisStats";
import { useDueDiligenceStats } from "./useDueDiligenceStats";
import { useDocumentosStats } from "./useDocumentosStats";
import { useDenunciasStats } from "./useDenunciasStats";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * O próximo passo naquele domínio, com o número que o justifica.
 *
 * `null` significa "nada por fazer" — e o cartão diz isso, em vez de mostrar
 * um zero indistinguível de qualquer outro número. Zero pendências e zero
 * registos desenhavam-se igual, e são o oposto um do outro.
 */
export interface AcaoDoDominio {
  /** Chave em `dashWidgets.radar.acoes.*`. */
  chave: string;
  n: number;
}

export interface RadarDataPoint {
  subject: string;
  score: number;
  fullMark: 100;
  hasData: boolean;
  details: {
    total: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    metrics: string[];
  };
  /** O que falta fazer aqui. Alimenta o rodapé do cartão do domínio. */
  acao: AcaoDoDominio | null;
  link: string;
  icon: string;
}

const getStatus = (score: number): 'excellent' | 'good' | 'warning' | 'critical' => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
};

/** Só há ação quando há número. Zero devolve `null` e o cartão fica limpo. */
const acao = (chave: string, n: number): AcaoDoDominio | null => (n > 0 ? { chave, n } : null);

export const useRadarChartData = () => {
  const { t } = useLanguage();
  /*
    `count` liga o plural nativo do `t()` (`{ one, other }`); `n` mantém os
    textos que não são contagem, como "Score médio: {n}". Passar os dois deixa
    cada string escolher o placeholder que lhe serve.
  */
  const m = (key: string, n: number | string) =>
    t(`dashWidgets.radar.metrics.${key}`, { count: n, n });
  const ativos = useAtivosStats();
  const controles = useControlesStats();
  const riscos = useRiscosStats();
  const incidentes = useIncidentesStats();
  const gapAnalysis = useGapAnalysisStats();
  const dueDiligence = useDueDiligenceStats();
  const documentos = useDocumentosStats();
  const denuncias = useDenunciasStats();

  const isLoading = ativos.isLoading || controles.isLoading || riscos.isLoading ||
    incidentes.isLoading || gapAnalysis.isLoading || dueDiligence.isLoading ||
    documentos.isLoading || denuncias.isLoading;

  const data = useMemo((): RadarDataPoint[] => {
    const ativosData = ativos.data;
    const controlesData = controles.data;
    const riscosData = riscos.data;
    const incidentesData = incidentes.data;
    const gapData = gapAnalysis.data;
    const dueDiligenceData = dueDiligence.data;
    const documentosData = documentos.data;
    const denunciasData = denuncias.data;

    if (!ativosData || !controlesData || !riscosData || !incidentesData ||
        !gapData || !dueDiligenceData || !documentosData || !denunciasData) {
      return [];
    }

    /**
     * Riscos: exposição EM ABERTO, não a fotografia do registo inteiro.
     *
     * Era a média ponderada das severidades (crítico 4, alto 3, médio 2,
     * baixo 1) sobre o pior caso. Três defeitos medidos:
     *
     *  1. **Cadastrar risco baixo melhorava a nota.** Com a carteira real
     *     (1 crítico, 7 altos, 2 médios, 1 baixo → 32), acrescentar um risco
     *     BAIXO levava a 35. Identificar mais riscos subia o número sem que
     *     nada fosse tratado — o mesmo defeito que já tinha sido retirado de
     *     `useRiscosStats` e que tinha ficado vivo aqui.
     *
     *  2. **O tecto era 75, não 100.** Uma carteira inteira de riscos baixos
     *     dá `(n×1)/(n×4)` = 25% de exposição, logo 75 pontos. Não havia
     *     gestão possível que chegasse a 100 — só não ter riscos nenhuns.
     *
     *  3. **Ignorava o apetite declarado pela empresa**, que é a régua que o
     *     resto do produto usa para decidir o que é aceitável.
     *
     * Passa a somar duas coisas que a gestão de risco de facto controla:
     * quanto da carteira está DENTRO do apetite, e quanto dela foi sequer
     * avaliada. A cobertura é o que impede o registo inflacionado de pagar:
     * abrir riscos e não os avaliar agora BAIXA a nota.
     */
    const scoreRiscos = riscosData.total > 0
      ? Math.max(0, Math.round(
          (riscosData.avaliados > 0
            ? (1 - riscosData.acimaApetite / riscosData.avaliados) * 70
            : 0) +
          (riscosData.avaliados / riscosData.total) * 30,
        ))
      : 0;

    // `vencendoAvaliacao` conta o que vence nos próximos 30 dias; `vencidos`
    // conta o que já passou do prazo. O eixo lia o primeiro e ignorava o
    // segundo: 75 pontos ("Bom") numa empresa com 88 de 116 reavaliações em
    // atraso e zero a vencer.
    const scoreControles = controlesData.total > 0
      ? (
          (controlesData.ativos / controlesData.total) * 50 +
          ((controlesData.total - controlesData.vencidos) / controlesData.total) * 50
        )
      : 0;

    /**
     * Ativos: 80 pontos ("Excelente") numa carteira de 3 ativos todos de
     * criticidade ALTA, porque só `critico` penalizava — e os 20 pontos do
     * valor de negócio evaporavam em silêncio quando ninguém o classificou.
     *
     * Agora `alto` pesa metade de `critico`, e quando não há um único ativo com
     * valor informado os 20 pontos são redistribuídos pelos dois primeiros
     * termos em vez de virarem zero: um dado em falta não é uma nota baixa.
     */
    const scoreAtivos = ativosData.total > 0
      ? (() => {
          const exposicao = (ativosData.criticos + ativosData.altos * 0.5) / ativosData.total;
          /*
            O terceiro termo mede COBERTURA DA CLASSIFICAÇÃO, não quantos
            ativos são de alto valor.

            Lia `altoValorNegocio > 0`, e por isso não distinguia "ninguém
            classificou" de "está tudo classificado como valor baixo": as duas
            situações dão zero, e as duas perdiam os mesmos 20 pontos. Uma
            empresa que classificou a carteira inteira com rigor era tratada
            como uma que nunca abriu o campo.

            A redistribuição fica: um dado em falta continua a não ser uma nota
            baixa — o que muda é passar a saber quando ele não está em falta.
          */
          const temValor = ativosData.classificados > 0;
          const pesoEstado = temValor ? 50 : 62.5;
          const pesoExposicao = temValor ? 30 : 37.5;
          return (
            (ativosData.ativos / ativosData.total) * pesoEstado +
            Math.max(0, 1 - exposicao) * pesoExposicao +
            (temValor ? (ativosData.classificados / ativosData.total) * 20 : 0)
          );
        })()
      : 0;

    /**
     * Incidentes: o que está aberto pesa; o que foi resolvido conta a favor.
     *
     * A fórmula anterior somava a severidade de TODOS os incidentes, sem olhar
     * ao estado. Na base real, 3 dos 5 estão resolvidos e pesavam igual a um
     * aberto — resolver um incidente não mexia no número. Pior: como era uma
     * média, o que mexia era registar incidentes leves, que diluíam o rácio.
     * Um módulo cujo trabalho é FECHAR incidentes não podia ter uma nota que
     * ignora o fecho.
     *
     * Agora: 60 pontos pela taxa de resolução — o trabalho feito — e 40 pela
     * ausência de casos graves ainda em curso. Um incidente crítico aberto
     * pesa o dobro de um alto; nada em curso vale os 40 inteiros.
     */
    const scoreIncidentes = incidentesData.total > 0
      ? Math.max(0, Math.round(
          (incidentesData.resolvidos / incidentesData.total) * 60 +
          (incidentesData.emCurso === 0
            ? 40
            : Math.max(0, 1 - (
                incidentesData.criticosEmCurso * 2 + incidentesData.altosEmCurso
              ) / incidentesData.emCurso) * 40),
        ))
      : 0;

    const scoreGapAnalysis = gapData.averageCompliance || 0;

    const scoreDueDiligence = dueDiligenceData.totalAssessments > 0
      ? (
          (dueDiligenceData.completedAssessments / dueDiligenceData.totalAssessments) * 40 +
          (dueDiligenceData.averageScore / 100) * 40 +
          (1 - (dueDiligenceData.expiredAssessments / dueDiligenceData.totalAssessments)) * 20
        )
      : 0;

    /**
     * Documentos: o terceiro termo lia `data_aprovacao`, que está por preencher
     * em TODOS os 49 documentos do produto — era estruturalmente zero. A Órigo
     * aparecia a 40/100 ("crítico") sem um único documento vencido.
     *
     * O que mede aprovação de facto é não estar pendente de aprovação.
     */
    const scoreDocumentos = documentosData.total > 0
      ? (
          (documentosData.ativos / documentosData.total) * 30 +
          ((documentosData.total - documentosData.vencidos) / documentosData.total) * 40 +
          ((documentosData.total - documentosData.pendentesAprovacao) / documentosData.total) * 30
        )
      : 0;

    const scoreDenuncias = denunciasData.total > 0
      ? (
          (denunciasData.resolvidas / denunciasData.total) * 60 +
          (1 - (denunciasData.novas / denunciasData.total)) * 20 +
          (1 - (denunciasData.em_andamento / denunciasData.total)) * 20
        )
      : 0;

    return [
      {
        subject: 'Riscos', score: Math.round(scoreRiscos), fullMark: 100, hasData: riscosData.total > 0, icon: 'AlertTriangle',
        details: { total: riscosData.total, status: getStatus(scoreRiscos), metrics: [m('critical', riscosData.criticos), m('high', riscosData.altos), m('treated', riscosData.tratados)] },
        acao: acao('tratarRiscos', riscosData.criticos + riscosData.altos),
        link: '/riscos'
      },
      {
        subject: 'Controles', score: Math.round(scoreControles), fullMark: 100, hasData: controlesData.total > 0, icon: 'Shield',
        details: { total: controlesData.total, status: getStatus(scoreControles), metrics: [m('active', controlesData.ativos), m('dueAssessment', controlesData.vencendoAvaliacao), m('critical', controlesData.criticos)] },
        // Vencidas e a vencer contam para a mesma decisão: reavaliar.
        acao: acao('avaliarControles', controlesData.vencidos + controlesData.vencendoAvaliacao),
        link: '/controles'
      },
      {
        subject: 'Ativos', score: Math.round(scoreAtivos), fullMark: 100, hasData: ativosData.total > 0, icon: 'Monitor',
        details: { total: ativosData.total, status: getStatus(scoreAtivos), metrics: [m('active', ativosData.ativos), m('critical', ativosData.criticos), m('highValue', ativosData.percentualAltoValor)] },
        acao: acao('ativosCriticos', ativosData.criticos),
        link: '/ativos'
      },
      {
        subject: 'Incidentes', score: Math.round(scoreIncidentes), fullMark: 100, hasData: incidentesData.total > 0, icon: 'Zap',
        /*
          `open` conta só `status = aberto`; a ação conta aberto + em
          investigação, que é o conjunto sobre o qual há decisão a tomar. Com
          os dois na frente um do outro, o cartão dizia "0 abertos" na linha
          de apoio e "1 incidente em aberto" no rodapé. A linha de apoio passa
          a levar a composição — crítico e do mês — e a contagem fica só no
          rodapé, uma vez. (`open` fica em terceiro: o cartão mostra dois.)
        */
        details: { total: incidentesData.total, status: getStatus(scoreIncidentes), metrics: [m('critical', incidentesData.criticos), m('inMonth', incidentesData.mes), m('open', incidentesData.abertos)] },
        acao: acao('incidentesAbertos', incidentesData.abertos + incidentesData.investigacao),
        link: '/incidentes'
      },
      {
        subject: 'Gap Analysis', score: Math.round(scoreGapAnalysis), fullMark: 100, hasData: (gapData.totalFrameworks || 0) > 0, icon: 'Target',
        details: { total: gapData.totalFrameworks || 0, status: getStatus(scoreGapAnalysis), metrics: [m('frameworks', gapData.totalFrameworks), m('inProgress', gapData.assessmentsInProgress), m('pendingItems', gapData.pendingItems)] },
        /*
          `pendingItems` conta avaliações com evidência PENDENTE — não são
          requisitos por avaliar. Chamar-lhes isso punha dois números
          diferentes com a mesma frase no mesmo ecrã: 127 aqui e 58 no cartão
          de frameworks, que conta o que ainda não foi avaliado.
        */
        acao: acao('evidenciasPendentes', gapData.pendingItems || 0),
        link: '/gap-analysis'
      },
      {
        subject: 'Due Diligence', score: Math.round(scoreDueDiligence), fullMark: 100, hasData: dueDiligenceData.totalAssessments > 0, icon: 'ClipboardCheck',
        details: { total: dueDiligenceData.totalAssessments, status: getStatus(scoreDueDiligence), metrics: [m('completed', dueDiligenceData.completedAssessments), m('avgScore', Math.round(dueDiligenceData.averageScore)), m('expired', dueDiligenceData.expiredAssessments)] },
        /*
          Sem nenhuma avaliação, o próximo passo é começar — e não "0 vencidas",
          que soaria a estado limpo num domínio onde nunca se fez nada.
        */
        acao:
          dueDiligenceData.totalAssessments === 0
            ? { chave: 'iniciarDueDiligence', n: 0 }
            : acao('ddVencidas', dueDiligenceData.expiredAssessments),
        link: '/due-diligence'
      },
      {
        subject: 'Documentos', score: Math.round(scoreDocumentos), fullMark: 100, hasData: documentosData.total > 0, icon: 'FileText',
        details: { total: documentosData.total, status: getStatus(scoreDocumentos), metrics: [m('active', documentosData.ativos), m('expiredDocs', documentosData.vencidos), m('approved', documentosData.aprovados)] },
        // Vencido aperta mais do que por aprovar: só um dos dois é mostrado.
        acao:
          acao('documentosVencidos', documentosData.vencidos) ??
          acao('documentosPorAprovar', documentosData.pendentesAprovacao),
        link: '/documentos'
      },
      {
        subject: 'Denúncias', score: Math.round(scoreDenuncias), fullMark: 100, hasData: denunciasData.total > 0, icon: 'MessageSquareWarning',
        details: { total: denunciasData.total, status: getStatus(scoreDenuncias), metrics: [m('resolved', denunciasData.resolvidas), m('newOnes', denunciasData.novas), m('ongoing', denunciasData.em_andamento)] },
        acao: acao('denunciasAbertas', denunciasData.novas + denunciasData.em_andamento),
        link: '/denuncia'
      }
    ];
  }, [
    ativos.data, controles.data, riscos.data, incidentes.data,
    gapAnalysis.data, dueDiligence.data, documentos.data, denuncias.data, t
  ]);

  return { data, isLoading };
};
