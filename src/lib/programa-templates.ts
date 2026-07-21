import type { Nivel } from '@/hooks/usePrograma';

// Modelos prontos de roadmap de implementação por framework. O usuário só ajusta
// os números; o Akuris recalcula progresso, orçamento e matriz automaticamente.

export interface TemplateItem {
  titulo: string;
  descricao?: string;
  esforco?: Nivel;
  impacto?: Nivel;
  custo_estimado?: number;
  ferramenta_sugerida?: string;
}

export interface TemplateFase {
  nome: string;
  itens: TemplateItem[];
}

export interface ProgramaTemplate {
  id: string;
  label: string;
  fases: TemplateFase[];
}

const ISO27001: ProgramaTemplate = {
  id: 'iso27001',
  label: 'ISO/IEC 27001',
  fases: [
    {
      nome: 'Escopo e contexto (SoA)',
      itens: [
        { titulo: 'Definir o escopo do SGSI', descricao: 'Limites, áreas, sistemas e localidades cobertos.', esforco: 'medio', impacto: 'alto' },
        { titulo: 'Elaborar a Declaração de Aplicabilidade (SoA)', esforco: 'medio', impacto: 'alto' },
        { titulo: 'Levantar partes interessadas e requisitos', esforco: 'baixo', impacto: 'medio' },
      ],
    },
    {
      nome: 'Avaliação de riscos',
      itens: [
        { titulo: 'Definir a metodologia de avaliação de riscos', esforco: 'medio', impacto: 'alto' },
        { titulo: 'Executar a avaliação de riscos dos ativos', esforco: 'alto', impacto: 'alto' },
        { titulo: 'Definir o plano de tratamento de riscos', esforco: 'medio', impacto: 'alto' },
      ],
    },
    {
      nome: 'Políticas e processos',
      itens: [
        { titulo: 'Política de Segurança da Informação', esforco: 'baixo', impacto: 'alto' },
        { titulo: 'Política de Controle de Acesso', esforco: 'baixo', impacto: 'alto' },
        { titulo: 'Política de Backup e Continuidade', esforco: 'baixo', impacto: 'medio' },
        { titulo: 'Processo de gestão de fornecedores', esforco: 'medio', impacto: 'medio' },
      ],
    },
    {
      nome: 'Controles técnicos',
      itens: [
        { titulo: 'Implantar MFA e gestão de identidade', esforco: 'baixo', impacto: 'alto', custo_estimado: 15000, ferramenta_sugerida: 'Microsoft Entra / Okta' },
        { titulo: 'Centralizar logs e monitoramento (SIEM)', esforco: 'alto', impacto: 'alto', custo_estimado: 60000, ferramenta_sugerida: 'Wazuh / Splunk' },
        { titulo: 'Gestão de vulnerabilidades', esforco: 'medio', impacto: 'alto', custo_estimado: 20000, ferramenta_sugerida: 'Tenable / Qualys' },
        { titulo: 'Proteção de endpoint (EDR)', esforco: 'medio', impacto: 'alto', custo_estimado: 30000, ferramenta_sugerida: 'CrowdStrike / Defender' },
        { titulo: 'Backup e recuperação', esforco: 'medio', impacto: 'medio', custo_estimado: 12000, ferramenta_sugerida: 'Veeam' },
        { titulo: 'Criptografia de dados sensíveis', esforco: 'medio', impacto: 'medio' },
      ],
    },
    {
      nome: 'Pessoas e conscientização',
      itens: [
        { titulo: 'Programa de conscientização em segurança', esforco: 'baixo', impacto: 'medio', custo_estimado: 8000, ferramenta_sugerida: 'KnowBe4 / Hoxhunt' },
        { titulo: 'Treinamento da equipe de TI', esforco: 'baixo', impacto: 'medio' },
      ],
    },
    {
      nome: 'Auditoria interna e revisão',
      itens: [
        { titulo: 'Realizar auditoria interna', esforco: 'medio', impacto: 'alto' },
        { titulo: 'Análise crítica pela direção', esforco: 'baixo', impacto: 'alto' },
        { titulo: 'Tratar não conformidades', esforco: 'medio', impacto: 'alto' },
      ],
    },
    {
      nome: 'Certificação',
      itens: [
        { titulo: 'Selecionar organismo certificador', esforco: 'baixo', impacto: 'alto', custo_estimado: 40000 },
        { titulo: 'Auditoria Estágio 1 (documental)', esforco: 'medio', impacto: 'alto' },
        { titulo: 'Auditoria Estágio 2 (certificação)', esforco: 'alto', impacto: 'alto' },
      ],
    },
  ],
};

// Fallback genérico para qualquer framework — a mesma jornada, sem itens pré-preenchidos.
const GENERICO: ProgramaTemplate = {
  id: 'generico',
  label: 'Genérico',
  fases: [
    { nome: 'Diagnóstico e escopo', itens: [
      { titulo: 'Definir escopo e responsáveis', esforco: 'baixo', impacto: 'alto' },
      { titulo: 'Rodar o gap analysis do framework', esforco: 'medio', impacto: 'alto' },
    ] },
    { nome: 'Planejamento', itens: [
      { titulo: 'Priorizar requisitos não atendidos', esforco: 'medio', impacto: 'alto' },
    ] },
    { nome: 'Implementação', itens: [
      { titulo: 'Implementar controles e políticas', esforco: 'alto', impacto: 'alto' },
    ] },
    { nome: 'Evidências e auditoria', itens: [
      { titulo: 'Coletar evidências dos controles', esforco: 'medio', impacto: 'medio' },
      { titulo: 'Auditoria interna', esforco: 'medio', impacto: 'alto' },
    ] },
    { nome: 'Certificação / atestação', itens: [
      { titulo: 'Auditoria externa', esforco: 'alto', impacto: 'alto' },
    ] },
  ],
};

/** Resolve o modelo mais adequado a partir do nome do framework. */
export function getTemplateForFramework(frameworkNome?: string | null): ProgramaTemplate {
  const n = (frameworkNome || '').toLowerCase();
  if (n.includes('27001') || n.includes('27701') || n.includes('isms') || n.includes('sgsi')) return ISO27001;
  return GENERICO;
}
