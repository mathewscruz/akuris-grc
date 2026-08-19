/**
 * Uma escala só, para todos os frameworks.
 *
 * O NIST CSF era o único avaliado numa escala 0–5 (`conforme: 5.0`,
 * `parcial: 2.5`), enquanto os outros vinte e um usavam percentagem. O
 * resultado, medido na tela: a lista de frameworks mostrava **44** para o NIST
 * e o detalhe do mesmo framework mostrava **2%** — porque a lista já usava a
 * conta única em percentagem e o detalhe ainda usava a escala do config. Pior:
 * o histórico gravado por trigger no banco também é percentagem, portanto o
 * gráfico de evolução contradizia o número no topo da própria página.
 *
 * As duas escalas eram, aliás, o mesmo número: 5.0/2.5 é exatamente 100/50
 * dividido por vinte. Não se perde informação ao unificar — perde-se a
 * divergência. E o produto passa a oferecer a mesma leitura seja qual for o
 * framework escolhido.
 */
export type ScoreType = 'percentage';
export type ConformityStatus = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel' | 'nao_avaliado';

export const NIST_PILLAR_NAMES: Record<string, string> = {
  'GOVERN': 'Governar',
  'IDENTIFY': 'Identificar',
  'PROTECT': 'Proteger',
  'DETECT': 'Detectar',
  'RESPOND': 'Responder',
  'RECOVER': 'Recuperar',
};

export interface FrameworkConfig {
  id: string;
  name: string;
  scoreType: ScoreType;
  chartType?: 'radar' | 'funnel' | 'treemap' | 'gauge' | 'stacked';
  pillarField: string;
  scoreLabels: {
    excellent: { label: string; min: number; max: number; color: string };
    good: { label: string; min: number; max: number; color: string };
    regular: { label: string; min: number; max: number; color: string };
    insufficient: { label: string; min: number; max: number; color: string };
    critical: { label: string; min: number; max: number; color: string };
  };
  statusScores: Record<ConformityStatus, number>;
  sections?: {
    id: string;
    title: string;
    filter: (codigo: string | null) => boolean;
  }[];
  domains?: {
    id: string;
    name: string;
    color: string;
  }[];
  /** Label shown above domain cards in the dashboard */
  domainLabel?: string;
  /** Label shown above section cards in the dashboard */
  sectionLabel?: string;
}

// === Shared score label presets ===
const PERCENTAGE_SCORE_LABELS = {
  excellent: { label: 'Conforme', min: 80, max: 100, color: 'text-success' },
  good: { label: 'Parcialmente Conforme', min: 60, max: 79, color: 'text-info' },
  regular: { label: 'Em Implementação', min: 40, max: 59, color: 'text-warning' },
  insufficient: { label: 'Não Conforme', min: 20, max: 39, color: 'text-warning' },
  critical: { label: 'Crítico', min: 0, max: 19, color: 'text-destructive' },
};

const PERCENTAGE_STATUS_SCORES: Record<ConformityStatus, number> = {
  conforme: 100,
  parcial: 50,
  nao_conforme: 0,
  nao_aplicavel: 0,
  nao_avaliado: 0,
};

// === Framework Configs ===
export const FRAMEWORK_CONFIGS: Record<string, FrameworkConfig> = {
  'nist-csf-2.0': {
    id: 'nist-csf-2.0',
    name: 'NIST CSF 2.0',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Pilar',
  },
  'iso-27001': {
    id: 'iso-27001',
    name: 'ISO 27001:2022',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Domínio do Anexo A',
    sectionLabel: 'Aderência por Seção',
    sections: [
      { id: 'sgsi', title: 'Requisitos do SGSI (Cláusulas 4-10)', filter: (codigo) => !codigo?.startsWith('A.') },
      { id: 'anexo-a', title: 'Controles do Anexo A', filter: (codigo) => !!codigo?.startsWith('A.') },
    ],
    domains: [
      { id: 'A.5', name: 'A.5 - Controles Organizacionais', color: '#8b5cf6' },
      { id: 'A.6', name: 'A.6 - Controles de Pessoas', color: '#3b82f6' },
      { id: 'A.7', name: 'A.7 - Controles Físicos', color: '#10b981' },
      { id: 'A.8', name: 'A.8 - Controles Tecnológicos', color: '#f59e0b' },
    ],
  },
  'pci-dss': {
    id: 'pci-dss',
    name: 'PCI DSS',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Domínio PCI DSS',
    domains: [
      { id: 'network', name: 'Segurança de Rede', color: '#ef4444' },
      { id: 'data', name: 'Proteção de Dados', color: '#f59e0b' },
      { id: 'vuln', name: 'Gestão de Vulnerabilidades', color: '#8b5cf6' },
      { id: 'access', name: 'Controle de Acesso', color: '#3b82f6' },
      { id: 'monitor', name: 'Monitoramento e Testes', color: '#10b981' },
      { id: 'policy', name: 'Políticas de Segurança', color: '#6366f1' },
    ],
  },
  'soc-2': {
    id: 'soc-2',
    name: 'SOC 2',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Trust Services Criteria',
    domains: [
      { id: 'security', name: 'Security', color: '#ef4444' },
      { id: 'availability', name: 'Availability', color: '#3b82f6' },
      { id: 'processing', name: 'Processing Integrity', color: '#8b5cf6' },
      { id: 'confidentiality', name: 'Confidentiality', color: '#f59e0b' },
      { id: 'privacy', name: 'Privacy', color: '#10b981' },
    ],
  },
  'lgpd': {
    id: 'lgpd',
    name: 'LGPD',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Capítulo',
  },
  'gdpr': {
    id: 'gdpr',
    name: 'GDPR',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Capítulo',
  },
  'hipaa': {
    id: 'hipaa',
    name: 'HIPAA',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Salvaguarda',
    domains: [
      { id: 'admin', name: 'Salvaguardas Administrativas', color: '#8b5cf6' },
      { id: 'physical', name: 'Salvaguardas Físicas', color: '#3b82f6' },
      { id: 'technical', name: 'Salvaguardas Técnicas', color: '#10b981' },
    ],
  },
  'cis-controls': {
    id: 'cis-controls',
    name: 'CIS Controls',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Grupo de Controles',
  },
  'cobit': {
    id: 'cobit',
    name: 'COBIT',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Domínio COBIT',
    domains: [
      { id: 'EDM', name: 'EDM - Avaliar, Dirigir e Monitorar', color: '#8b5cf6' },
      { id: 'APO', name: 'APO - Alinhar, Planejar e Organizar', color: '#3b82f6' },
      { id: 'BAI', name: 'BAI - Construir, Adquirir e Implementar', color: '#10b981' },
      { id: 'DSS', name: 'DSS - Entregar, Servir e Suportar', color: '#f59e0b' },
      { id: 'MEA', name: 'MEA - Monitorar, Avaliar e Analisar', color: '#ef4444' },
    ],
  },
  'sox': {
    id: 'sox',
    name: 'SOX',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Seção SOX',
    domains: [
      { id: '302', name: 'Seção 302 - Certificação', color: '#3b82f6' },
      { id: '404', name: 'Seção 404 - Controles Internos', color: '#8b5cf6' },
      { id: '906', name: 'Seção 906 - Responsabilidade', color: '#ef4444' },
      { id: 'other', name: 'Outros Controles', color: '#10b981' },
    ],
  },
  'nis2': {
    id: 'nis2',
    name: 'NIS2',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Artigo NIS2',
  },
  'iso-27701': {
    id: 'iso-27701',
    name: 'ISO 27701',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Seção',
  },
  'iso-9001': {
    id: 'iso-9001',
    name: 'ISO 9001',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Cláusula',
    sectionLabel: 'Ciclo PDCA',
  },
  'iso-14001': {
    id: 'iso-14001',
    name: 'ISO 14001',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Cláusula',
    sectionLabel: 'Ciclo PDCA',
  },
  'iso-37301': {
    id: 'iso-37301',
    name: 'ISO 37301',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Cláusula',
  },
  'iso-20000': {
    id: 'iso-20000',
    name: 'ISO 20000',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Cláusula',
  },
  'iso-31000': {
    id: 'iso-31000',
    name: 'ISO 31000',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Princípio',
  },
  'itil': {
    id: 'itil',
    name: 'ITIL',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Prática',
  },
  'ccpa': {
    id: 'ccpa',
    name: 'CCPA',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Seção',
  },
  'coso-erm': {
    id: 'coso-erm',
    name: 'COSO ERM',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Componente',
    domains: [
      { id: 'governance', name: 'Governança e Cultura', color: '#8b5cf6' },
      { id: 'strategy', name: 'Estratégia e Objetivos', color: '#3b82f6' },
      { id: 'performance', name: 'Desempenho', color: '#10b981' },
      { id: 'review', name: 'Revisão e Correção', color: '#f59e0b' },
      { id: 'information', name: 'Informação e Comunicação', color: '#ef4444' },
    ],
  },
  'coso-ic': {
    id: 'coso-ic',
    name: 'COSO IC',
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Componente',
    domains: [
      { id: 'environment', name: 'Ambiente de Controle', color: '#8b5cf6' },
      { id: 'risk', name: 'Avaliação de Riscos', color: '#ef4444' },
      { id: 'activities', name: 'Atividades de Controle', color: '#3b82f6' },
      { id: 'info', name: 'Informação e Comunicação', color: '#10b981' },
      { id: 'monitoring', name: 'Monitoramento', color: '#f59e0b' },
    ],
  },
};

export function getFrameworkConfig(frameworkName: string, frameworkType?: string): FrameworkConfig | null {
  const lower = frameworkName.toLowerCase();

  // Direct matches
  if (lower.includes('nist')) return FRAMEWORK_CONFIGS['nist-csf-2.0'];
  if (lower.includes('iso') && frameworkName.includes('27001')) return FRAMEWORK_CONFIGS['iso-27001'];
  if (lower.includes('pci')) return FRAMEWORK_CONFIGS['pci-dss'];
  if (lower.includes('soc')) return FRAMEWORK_CONFIGS['soc-2'];
  if (lower.includes('lgpd')) return FRAMEWORK_CONFIGS['lgpd'];
  if (lower.includes('gdpr')) return FRAMEWORK_CONFIGS['gdpr'];
  if (lower.includes('hipaa')) return FRAMEWORK_CONFIGS['hipaa'];
  if (lower.includes('cis')) return FRAMEWORK_CONFIGS['cis-controls'];
  if (lower.includes('cobit')) return FRAMEWORK_CONFIGS['cobit'];
  if (lower.includes('sox')) return FRAMEWORK_CONFIGS['sox'];
  if (lower.includes('nis2') || lower.includes('nis 2')) return FRAMEWORK_CONFIGS['nis2'];
  if (lower.includes('27701')) return FRAMEWORK_CONFIGS['iso-27701'];
  if (lower.includes('ccpa')) return FRAMEWORK_CONFIGS['ccpa'];
  if (lower.includes('itil')) return FRAMEWORK_CONFIGS['itil'];
  if (lower.includes('coso') && lower.includes('erm')) return FRAMEWORK_CONFIGS['coso-erm'];
  if (lower.includes('coso') && (lower.includes('ic') || lower.includes('interno'))) return FRAMEWORK_CONFIGS['coso-ic'];
  if (lower.includes('coso')) return FRAMEWORK_CONFIGS['coso-erm'];
  if (lower.includes('31000')) return FRAMEWORK_CONFIGS['iso-31000'];
  if (lower.includes('9001')) return FRAMEWORK_CONFIGS['iso-9001'];
  if (lower.includes('14001')) return FRAMEWORK_CONFIGS['iso-14001'];
  if (lower.includes('37301')) return FRAMEWORK_CONFIGS['iso-37301'];
  if (lower.includes('20000')) return FRAMEWORK_CONFIGS['iso-20000'];

  // Default
  return {
    id: 'default',
    name: frameworkName,
    scoreType: 'percentage',
    chartType: 'treemap',
    pillarField: 'categoria',
    scoreLabels: PERCENTAGE_SCORE_LABELS,
    statusScores: PERCENTAGE_STATUS_SCORES,
    domainLabel: 'Aderência por Categoria',
  };
}

// === Maturity Model ===
export interface MaturityLevel {
  level: number;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
}

const MATURITY_LEVELS: MaturityLevel[] = [
  { level: 1, name: 'Inicial', description: 'Processos ad-hoc, sem controles formais', color: 'text-destructive', bgColor: 'bg-destructive/15 dark:bg-destructive/30', icon: '🔴' },
  { level: 2, name: 'Gerenciado', description: 'Controles básicos implementados, mas reativos', color: 'text-warning', bgColor: 'bg-warning/15 dark:bg-warning/30', icon: '🟠' },
  { level: 3, name: 'Definido', description: 'Processos documentados e padronizados', color: 'text-warning', bgColor: 'bg-warning/15 dark:bg-warning/30', icon: '🟡' },
  { level: 4, name: 'Otimizado', description: 'Processos medidos e controlados proativamente', color: 'text-info', bgColor: 'bg-info/15 dark:bg-info/30', icon: '🔵' },
  { level: 5, name: 'Excelência', description: 'Melhoria contínua com inovação e benchmark', color: 'text-success', bgColor: 'bg-success/15 dark:bg-success/30', icon: '🟢' },
];

export function getMaturityLevel(score: number, config: FrameworkConfig): MaturityLevel {
  const normalizedScore = config.scoreType === 'percentage' ? score : (score / 5.0) * 100;
  if (normalizedScore >= 80) return MATURITY_LEVELS[4];
  if (normalizedScore >= 60) return MATURITY_LEVELS[3];
  if (normalizedScore >= 40) return MATURITY_LEVELS[2];
  if (normalizedScore >= 20) return MATURITY_LEVELS[1];
  return MATURITY_LEVELS[0];
}

export function getScoreLabel(score: number, config: FrameworkConfig): string {
  const labels = config.scoreLabels;
  if (score >= labels.excellent.min) return labels.excellent.label;
  if (score >= labels.good.min) return labels.good.label;
  if (score >= labels.regular.min) return labels.regular.label;
  if (score >= labels.insufficient.min) return labels.insufficient.label;
  return labels.critical.label;
}

export function getScoreColor(score: number, config: FrameworkConfig): string {
  const labels = config.scoreLabels;
  if (score >= labels.excellent.min) return labels.excellent.color;
  if (score >= labels.good.min) return labels.good.color;
  if (score >= labels.regular.min) return labels.regular.color;
  if (score >= labels.insufficient.min) return labels.insufficient.color;
  return labels.critical.color;
}
