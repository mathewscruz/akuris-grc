import { useMemo } from "react";
import { useAtivosStats } from "./useAtivosStats";
import { useControlesStats } from "./useControlesStats";
import { useIncidentesStats } from "./useIncidentesStats";
import { useRiscosStats } from "./useRiscosStats";
import { useGapAnalysisStats } from "./useGapAnalysisStats";
import { useDueDiligenceStats } from "./useDueDiligenceStats";
import { useDocumentosStats } from "./useDocumentosStats";
import { useDenunciasStats } from "./useDenunciasStats";

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

    const scoreRiscos = riscosData.total > 0
      ? Math.max(0, 100 - (
          (riscosData.criticos * 100 + riscosData.altos * 75 + riscosData.medios * 50 + riscosData.baixos * 25) /
          (riscosData.total * 100)
        ))
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

    // Base zero: módulos sem incidentes não pontuam (hasData=false na Maturidade).
    const scoreIncidentes = incidentesData.total > 0
      ? Math.min(100, Math.max(0, 100 - (
          (incidentesData.criticos * 100 + incidentesData.altos * 75 + incidentesData.medios * 50 + incidentesData.baixos * 25) /
          (incidentesData.total * 100)
        )))
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
        details: { total: riscosData.total, status: getStatus(scoreRiscos), metrics: [`${riscosData.criticos} críticos`, `${riscosData.altos} altos`, `${riscosData.tratados} tratados`] },
        link: '/riscos'
      },
      {
        subject: 'Controles', score: Math.round(scoreControles), fullMark: 100, hasData: controlesData.total > 0, icon: 'Shield',
        details: { total: controlesData.total, status: getStatus(scoreControles), metrics: [`${controlesData.ativos} ativos`, `${controlesData.vencendoAvaliacao} vencendo avaliação`, `${controlesData.criticos} críticos`] },
        link: '/controles'
      },
      {
        subject: 'Ativos', score: Math.round(scoreAtivos), fullMark: 100, hasData: ativosData.total > 0, icon: 'Monitor',
        details: { total: ativosData.total, status: getStatus(scoreAtivos), metrics: [`${ativosData.ativos} ativos`, `${ativosData.criticos} críticos`, `${ativosData.percentualAltoValor}% alto valor`] },
        link: '/ativos'
      },
      {
        subject: 'Incidentes', score: Math.round(scoreIncidentes), fullMark: 100, hasData: incidentesData.total > 0, icon: 'Zap',
        details: { total: incidentesData.total, status: getStatus(scoreIncidentes), metrics: [`${incidentesData.abertos} abertos`, `${incidentesData.criticos} críticos`, `${incidentesData.mes} no mês`] },
        link: '/incidentes'
      },
      {
        subject: 'Gap Analysis', score: Math.round(scoreGapAnalysis), fullMark: 100, hasData: (gapData.totalFrameworks || 0) > 0, icon: 'Target',
        details: { total: gapData.totalFrameworks || 0, status: getStatus(scoreGapAnalysis), metrics: [`${gapData.totalFrameworks} frameworks`, `${gapData.assessmentsInProgress} em progresso`, `${gapData.pendingItems} itens pendentes`] },
        link: '/gap-analysis'
      },
      {
        subject: 'Due Diligence', score: Math.round(scoreDueDiligence), fullMark: 100, hasData: dueDiligenceData.totalAssessments > 0, icon: 'ClipboardCheck',
        details: { total: dueDiligenceData.totalAssessments, status: getStatus(scoreDueDiligence), metrics: [`${dueDiligenceData.completedAssessments} completos`, `Score médio: ${Math.round(dueDiligenceData.averageScore)}`, `${dueDiligenceData.expiredAssessments} expirados`] },
        link: '/due-diligence'
      },
      {
        subject: 'Documentos', score: Math.round(scoreDocumentos), fullMark: 100, hasData: documentosData.total > 0, icon: 'FileText',
        details: { total: documentosData.total, status: getStatus(scoreDocumentos), metrics: [`${documentosData.ativos} ativos`, `${documentosData.vencidos} vencidos`, `${documentosData.aprovados} aprovados`] },
        link: '/documentos'
      },
      {
        subject: 'Denúncias', score: Math.round(scoreDenuncias), fullMark: 100, hasData: denunciasData.total > 0, icon: 'MessageSquareWarning',
        details: { total: denunciasData.total, status: getStatus(scoreDenuncias), metrics: [`${denunciasData.resolvidas} resolvidas`, `${denunciasData.novas} novas`, `${denunciasData.em_andamento} em andamento`] },
        link: '/denuncia'
      }
    ];
  }, [
    ativos.data, controles.data, riscos.data, incidentes.data,
    gapAnalysis.data, dueDiligence.data, documentos.data, denuncias.data
  ]);

  return { data, isLoading };
};
