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
  link: string;
  icon: string;
}

const getStatus = (score: number): 'excellent' | 'good' | 'warning' | 'critical' => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
};

export const useRadarChartData = () => {
  const { t } = useLanguage();
  const m = (key: string, n: number | string) => t(`dashWidgets.radar.metrics.${key}`, { n });
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

    // Riscos: alinhado com RiskScoreTimeline.computeExposure (peso 4/3/2/1).
    // Saúde do módulo = 100 - exposição (maior = melhor).
    const scoreRiscos = riscosData.total > 0
      ? Math.max(0, Math.round(100 - (
          (riscosData.criticos * 4 + riscosData.altos * 3 + riscosData.medios * 2 + riscosData.baixos * 1) /
          (riscosData.total * 4)
        ) * 100))
      : 0;

    const scoreControles = controlesData.total > 0
      ? (
          (controlesData.ativos / controlesData.total) * 50 +
          ((controlesData.total - controlesData.vencendoAvaliacao) / controlesData.total) * 50
        )
      : 0;

    const scoreAtivos = ativosData.total > 0
      ? (
          (ativosData.ativos / ativosData.total) * 50 +
          (1 - (ativosData.criticos / ativosData.total)) * 30 +
          (ativosData.altoValorNegocio / ativosData.total) * 20
        )
      : 0;

    // Incidentes: mesma lógica de exposição ponderada (crítico=4, alto=3, médio=2, baixo=1).
    const scoreIncidentes = incidentesData.total > 0
      ? Math.max(0, Math.round(100 - (
          (incidentesData.criticos * 4 + incidentesData.altos * 3 + incidentesData.medios * 2 + incidentesData.baixos * 1) /
          (incidentesData.total * 4)
        ) * 100))
      : 0;

    const scoreGapAnalysis = gapData.averageCompliance || 0;

    const scoreDueDiligence = dueDiligenceData.totalAssessments > 0
      ? (
          (dueDiligenceData.completedAssessments / dueDiligenceData.totalAssessments) * 40 +
          (dueDiligenceData.averageScore / 100) * 40 +
          (1 - (dueDiligenceData.expiredAssessments / dueDiligenceData.totalAssessments)) * 20
        )
      : 0;

    const scoreDocumentos = documentosData.total > 0
      ? (
          (documentosData.ativos / documentosData.total) * 30 +
          ((documentosData.total - documentosData.vencidos) / documentosData.total) * 40 +
          (documentosData.aprovados / documentosData.total) * 30
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
        link: '/riscos'
      },
      {
        subject: 'Controles', score: Math.round(scoreControles), fullMark: 100, hasData: controlesData.total > 0, icon: 'Shield',
        details: { total: controlesData.total, status: getStatus(scoreControles), metrics: [m('active', controlesData.ativos), m('dueAssessment', controlesData.vencendoAvaliacao), m('critical', controlesData.criticos)] },
        link: '/controles'
      },
      {
        subject: 'Ativos', score: Math.round(scoreAtivos), fullMark: 100, hasData: ativosData.total > 0, icon: 'Monitor',
        details: { total: ativosData.total, status: getStatus(scoreAtivos), metrics: [m('active', ativosData.ativos), m('critical', ativosData.criticos), m('highValue', ativosData.percentualAltoValor)] },
        link: '/ativos'
      },
      {
        subject: 'Incidentes', score: Math.round(scoreIncidentes), fullMark: 100, hasData: incidentesData.total > 0, icon: 'Zap',
        details: { total: incidentesData.total, status: getStatus(scoreIncidentes), metrics: [m('open', incidentesData.abertos), m('critical', incidentesData.criticos), m('inMonth', incidentesData.mes)] },
        link: '/incidentes'
      },
      {
        subject: 'Gap Analysis', score: Math.round(scoreGapAnalysis), fullMark: 100, hasData: (gapData.totalFrameworks || 0) > 0, icon: 'Target',
        details: { total: gapData.totalFrameworks || 0, status: getStatus(scoreGapAnalysis), metrics: [m('frameworks', gapData.totalFrameworks), m('inProgress', gapData.assessmentsInProgress), m('pendingItems', gapData.pendingItems)] },
        link: '/gap-analysis'
      },
      {
        subject: 'Due Diligence', score: Math.round(scoreDueDiligence), fullMark: 100, hasData: dueDiligenceData.totalAssessments > 0, icon: 'ClipboardCheck',
        details: { total: dueDiligenceData.totalAssessments, status: getStatus(scoreDueDiligence), metrics: [m('completed', dueDiligenceData.completedAssessments), m('avgScore', Math.round(dueDiligenceData.averageScore)), m('expired', dueDiligenceData.expiredAssessments)] },
        link: '/due-diligence'
      },
      {
        subject: 'Documentos', score: Math.round(scoreDocumentos), fullMark: 100, hasData: documentosData.total > 0, icon: 'FileText',
        details: { total: documentosData.total, status: getStatus(scoreDocumentos), metrics: [m('active', documentosData.ativos), m('expiredDocs', documentosData.vencidos), m('approved', documentosData.aprovados)] },
        link: '/documentos'
      },
      {
        subject: 'Denúncias', score: Math.round(scoreDenuncias), fullMark: 100, hasData: denunciasData.total > 0, icon: 'MessageSquareWarning',
        details: { total: denunciasData.total, status: getStatus(scoreDenuncias), metrics: [m('resolved', denunciasData.resolvidas), m('newOnes', denunciasData.novas), m('ongoing', denunciasData.em_andamento)] },
        link: '/denuncia'
      }
    ];
  }, [
    ativos.data, controles.data, riscos.data, incidentes.data,
    gapAnalysis.data, dueDiligence.data, documentos.data, denuncias.data, t
  ]);

  return { data, isLoading };
};
