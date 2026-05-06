import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Eye,
  ShieldCheck,
  FileSearch,
  Activity,
  CircleDot,
} from 'lucide-react';
import type { StatusTone, StatusIntensity } from '@/components/ui/status-badge';

export interface ToneResult {
  tone: StatusTone;
  intensity?: StatusIntensity;
  icon?: React.ReactNode;
}

/** Normaliza string (remove acentos + lowercase + trim). */
const norm = (raw?: string | null): string =>
  (raw ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ICON_PROPS = { strokeWidth: 1.5, className: 'h-3 w-3' };

// ─────────────────────────────────────────────────────────────────────────────
// Item Status (ativo, inativo, vencido, expirado, a_vencer, em_renovacao,
// em_rotacao, arquivado, descontinuado, revogado) — Ativos, Licenças, Chaves,
// Contas Privilegiadas, Documentos, Privacidade
// ─────────────────────────────────────────────────────────────────────────────
export const resolveItemStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'ativo':
    case 'ativa':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'inativo':
    case 'inativa':
    case 'arquivado':
    case 'arquivada':
    case 'descontinuado':
    case 'descontinuada':
    case 'revogado':
    case 'revogada':
      return { tone: 'neutral' };
    case 'vencido':
    case 'vencida':
    case 'expirado':
    case 'expirada':
      return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
    case 'a vencer':
    case 'a_vencer':
    case 'em renovacao':
    case 'em_renovacao':
    case 'em rotacao':
    case 'em_rotacao':
      return { tone: 'warning', icon: <Clock {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Contratos: status (ativo, negociacao, aprovacao, suspenso, encerrado,
// cancelado, rascunho, inativo)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveContratoStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'ativo':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'negociacao':
      return { tone: 'warning', icon: <FileSearch {...ICON_PROPS} /> };
    case 'aprovacao':
      return { tone: 'info', icon: <ShieldCheck {...ICON_PROPS} /> };
    case 'suspenso':
      return { tone: 'warning', icon: <PauseCircle {...ICON_PROPS} /> };
    case 'encerrado':
    case 'cancelado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    case 'rascunho':
    case 'inativo':
      return { tone: 'neutral', icon: <CircleDot {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Controles: tipo (preventivo, detectivo, corretivo) — categoria, sem alarme
// ─────────────────────────────────────────────────────────────────────────────
export const resolveControleTipoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'preventivo':
      return { tone: 'info' };
    case 'detectivo':
      return { tone: 'primary' };
    case 'corretivo':
      return { tone: 'success' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Documentos: classificação (confidencial, restrita, interna, publica)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveClassificacaoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'confidencial':
      return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
    case 'restrita':
      return { tone: 'warning', icon: <ShieldCheck {...ICON_PROPS} /> };
    case 'interna':
      return { tone: 'info' };
    case 'publica':
      return { tone: 'success' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Denúncias: status (nova, em_analise, em_investigacao, resolvida, arquivada)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveDenunciaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'nova':
      return { tone: 'info', icon: <CircleDot {...ICON_PROPS} /> };
    case 'em analise':
    case 'em_analise':
      return { tone: 'warning', icon: <FileSearch {...ICON_PROPS} /> };
    case 'em investigacao':
    case 'em_investigacao':
      return { tone: 'warning', intensity: 'high', icon: <Eye {...ICON_PROPS} /> };
    case 'resolvida':
    case 'resolvido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'arquivada':
    case 'arquivado':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sensibilidade de dados (sensivel/muito_sensivel, moderado/medio, comum/baixo)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveSensibilidadeTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'muito sensivel':
    case 'muito_sensivel':
      return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
    case 'sensivel':
      return { tone: 'destructive' };
    case 'moderado':
    case 'medio':
    case 'media':
      return { tone: 'warning' };
    case 'comum':
    case 'baixo':
    case 'baixa':
      return { tone: 'success' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Status (aberto, em_andamento, concluido, cancelado,
// aguardando_aprovacao) — Incidentes, Privacidade
// ─────────────────────────────────────────────────────────────────────────────
export const resolveWorkflowStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'aberto':
    case 'aberta':
    case 'novo':
    case 'nova':
      return { tone: 'info', icon: <CircleDot {...ICON_PROPS} /> };
    case 'em andamento':
    case 'em_andamento':
    case 'em analise':
    case 'em_analise':
      return { tone: 'info', icon: <Activity {...ICON_PROPS} /> };
    case 'aguardando aprovacao':
    case 'aguardando_aprovacao':
    case 'pendente':
    case 'pendente_aprovacao':
      return { tone: 'warning', icon: <Clock {...ICON_PROPS} /> };
    case 'concluido':
    case 'concluida':
    case 'resolvido':
    case 'resolvida':
    case 'fechado':
    case 'fechada':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'cancelado':
    case 'cancelada':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Documentos: tipo (documento, politica, procedimento, instrucao, formulario,
// certificado, contrato, relatorio) — categoria neutra com tons rotativos
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTipoDocumentoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'documento':
      return { tone: 'info' };
    case 'politica':
      return { tone: 'primary' };
    case 'procedimento':
      return { tone: 'warning' };
    case 'instrucao':
      return { tone: 'info' };
    case 'formulario':
      return { tone: 'neutral' };
    case 'certificado':
      return { tone: 'success' };
    case 'contrato':
      return { tone: 'primary' };
    case 'relatorio':
      return { tone: 'info' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Auditorias: status, tipo e prioridade
// ─────────────────────────────────────────────────────────────────────────────
export const resolveAuditoriaPrioridadeTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (v === 'critica' || v === 'critico')
    return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
  if (v === 'alta' || v === 'alto') return { tone: 'destructive' };
  if (v === 'media' || v === 'medio') return { tone: 'warning' };
  if (v === 'baixa' || v === 'baixo') return { tone: 'success' };
  return { tone: 'neutral' };
};

export const resolveAuditoriaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'planejamento':
    case 'planejada':
      return { tone: 'warning', icon: <FileSearch {...ICON_PROPS} /> };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info', icon: <Activity {...ICON_PROPS} /> };
    case 'concluida':
    case 'concluido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'cancelada':
    case 'cancelado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

export const resolveAuditoriaTipoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'interna':
      return { tone: 'info' };
    case 'externa':
      return { tone: 'primary' };
    case 'compliance':
      return { tone: 'warning' };
    case 'operacional':
      return { tone: 'success' };
    case 'ti':
      return { tone: 'info' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Riscos: status ciclo de vida
// ─────────────────────────────────────────────────────────────────────────────
export const resolveRiscoStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'identificado':
      return { tone: 'neutral', icon: <CircleDot {...ICON_PROPS} /> };
    case 'analisado':
    case 'em analise':
    case 'em_analise':
      return { tone: 'info', icon: <FileSearch {...ICON_PROPS} /> };
    case 'tratado':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'monitorado':
      return { tone: 'success', icon: <Eye {...ICON_PROPS} /> };
    case 'aceito':
      return { tone: 'warning', icon: <ShieldCheck {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Riscos: nível (escala de severidade)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveNivelRiscoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (v === 'critico')
    return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
  if (v === 'muito alto') return { tone: 'destructive', intensity: 'high' };
  if (v === 'alto') return { tone: 'destructive' };
  if (v === 'medio') return { tone: 'warning' };
  if (v === 'baixo') return { tone: 'success' };
  if (v === 'muito baixo') return { tone: 'success' };
  if (v === 'nao avaliado' || v === 'nao_avaliado' || v === '') return { tone: 'neutral' };
  return { tone: 'neutral' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tratamentos: tipo (categoria funcional)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTratamentoTipoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'mitigar':
      return { tone: 'info' };
    case 'transferir':
      return { tone: 'primary' };
    case 'aceitar':
      return { tone: 'warning' };
    case 'evitar':
      return { tone: 'success' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tratamentos: status (ciclo de execução)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTratamentoStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'pendente':
      return { tone: 'neutral', icon: <Clock {...ICON_PROPS} /> };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info', icon: <Activity {...ICON_PROPS} /> };
    case 'concluido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'cancelado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Due Diligence: status do assessment
// ─────────────────────────────────────────────────────────────────────────────
export const resolveDueDiligenceStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'pendente':
      return { tone: 'neutral', icon: <Clock {...ICON_PROPS} /> };
    case 'ativo':
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info', icon: <Activity {...ICON_PROPS} /> };
    case 'concluido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'expirado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    case 'pausado':
      return { tone: 'warning', icon: <PauseCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Aprovação (Aprovado / Rejeitado / Pendente)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveAprovacaoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'aprovado':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'rejeitado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    case 'pendente':
      return { tone: 'warning', icon: <Clock {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Revisão por dias (vencida, próxima, ok)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveRevisaoTone = (diasParaRevisao: number): ToneResult => {
  if (diasParaRevisao < 0) return { tone: 'destructive', icon: <AlertTriangle {...ICON_PROPS} /> };
  if (diasParaRevisao <= 7) return { tone: 'warning', icon: <Clock {...ICON_PROPS} /> };
  if (diasParaRevisao <= 30) return { tone: 'info' };
  return { tone: 'success' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Severidade (vulnerabilidades, incidentes)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveSeveridadeTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (v === 'critica' || v === 'critico')
    return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
  if (v === 'alta' || v === 'alto') return { tone: 'destructive' };
  if (v === 'media' || v === 'medio') return { tone: 'warning' };
  if (v === 'baixa' || v === 'baixo') return { tone: 'success' };
  if (v === 'informativa' || v === 'info') return { tone: 'info' };
  return { tone: 'neutral' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Controles: status (ativo, inativo, em_revisao, descontinuado)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveControleStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'ativo':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'inativo':
      return { tone: 'neutral' };
    case 'em revisao':
    case 'em_revisao':
      return { tone: 'warning', icon: <FileSearch {...ICON_PROPS} /> };
    case 'descontinuado':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Criticidade (controles, ativos)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveCriticidadeTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (v === 'critico' || v === 'critica')
    return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
  if (v === 'alto' || v === 'alta') return { tone: 'destructive' };
  if (v === 'medio' || v === 'media') return { tone: 'warning' };
  if (v === 'baixo' || v === 'baixa') return { tone: 'success' };
  return { tone: 'neutral' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Auditoria: status do item (pendente, em_andamento, concluido, nao_aplicavel)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveItemAuditoriaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'pendente':
      return { tone: 'neutral', icon: <Clock {...ICON_PROPS} /> };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info', icon: <Activity {...ICON_PROPS} /> };
    case 'concluido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'nao aplicavel':
    case 'nao_aplicavel':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// Alias semântico — Prioridade / Gravidade (alta/media/baixa/critica)
export const resolvePrioridadeTone = resolveCriticidadeTone;
export const resolveGravidadeTone = resolveCriticidadeTone;

// ─────────────────────────────────────────────────────────────────────────────
// Categoria (seguranca, privacidade, compliance, financeiro, operacional,
// qualidade, governanca, esg, geral) — categorias semânticas para badges
// ─────────────────────────────────────────────────────────────────────────────
export const resolveCategoriaTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'seguranca':
    case 'security':
      return { tone: 'destructive' };
    case 'privacidade':
    case 'privacy':
    case 'lgpd':
    case 'gdpr':
      return { tone: 'info' };
    case 'compliance':
    case 'conformidade':
      return { tone: 'info' };
    case 'financeiro':
    case 'finance':
      return { tone: 'success' };
    case 'operacional':
    case 'operations':
      return { tone: 'primary' };
    case 'qualidade':
    case 'quality':
      return { tone: 'warning' };
    case 'governanca':
    case 'governance':
      return { tone: 'primary' };
    case 'esg':
      return { tone: 'success' };
    case 'geral':
    case 'general':
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de pergunta (text, textarea, select, radio, checkbox, file, score, date)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveQuestionTypeTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'text':
    case 'textarea':
      return { tone: 'info' };
    case 'select':
    case 'radio':
    case 'checkbox':
    case 'booleano':
      return { tone: 'success' };
    case 'file':
      return { tone: 'primary' };
    case 'score':
      return { tone: 'warning' };
    case 'date':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Contratos: status de marco (pendente, concluido, atrasado, cancelado)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveMarcoStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'pendente':
      return { tone: 'warning', icon: <Clock {...ICON_PROPS} /> };
    case 'concluido':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'atrasado':
      return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
    case 'cancelado':
      return { tone: 'neutral', icon: <XCircle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Contratos: tipo de marco (categoria — tons distintos sem alarme)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveMarcoTipoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'vencimento':
      return { tone: 'destructive' };
    case 'renovacao':
      return { tone: 'info' };
    case 'pagamento':
      return { tone: 'success' };
    case 'entrega':
      return { tone: 'primary' };
    case 'revisao':
      return { tone: 'warning' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Gap Analysis: status de conformidade
// ─────────────────────────────────────────────────────────────────────────────
export const resolveConformityTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'conforme':
      return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
    case 'parcial':
      return { tone: 'warning' };
    case 'nao conforme':
    case 'nao_conforme':
      return { tone: 'destructive', icon: <XCircle {...ICON_PROPS} /> };
    case 'nao aplicavel':
    case 'nao_aplicavel':
      return { tone: 'neutral' };
    case 'nao avaliado':
    case 'nao_avaliado':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Estado ativo/inativo (boolean)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveAtivoTone = (ativo?: boolean | null): ToneResult => {
  if (ativo) return { tone: 'success', icon: <CheckCircle2 {...ICON_PROPS} /> };
  return { tone: 'neutral' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Acessos privilegiados: tipo de acesso (leitura, escrita, admin, completo)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTipoAcessoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'leitura':
      return { tone: 'info' };
    case 'escrita':
      return { tone: 'success' };
    case 'admin':
      return { tone: 'warning', icon: <ShieldCheck {...ICON_PROPS} /> };
    case 'completo':
      return { tone: 'destructive', intensity: 'high', icon: <AlertTriangle {...ICON_PROPS} /> };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Documentos: tipo de vinculação (categoria semântica)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveTipoVinculacaoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'relacionado':
      return { tone: 'info' };
    case 'evidencia':
      return { tone: 'success' };
    case 'suporte':
      return { tone: 'warning' };
    case 'implementacao':
      return { tone: 'primary' };
    case 'aprovacao':
      return { tone: 'destructive' };
    case 'revisao':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Genérico (fallback heurístico para qualquer status snake_case)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveGenericTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (!v) return { tone: 'neutral' };

  // Negativos
  if (
    /(critic|expir|rejeit|cancel|reprov|venci|falh|err|inativ|bloqued|bloque)/.test(v)
  )
    return { tone: 'destructive' };

  // Atenção
  if (/(pendent|atras|alta|alto|atenc|aceit|aguard|revis|risco)/.test(v))
    return { tone: 'warning' };

  // Em curso
  if (/(andament|process|analis|ativ|abert|nov|em_)/.test(v))
    return { tone: 'info' };

  // Positivos
  if (
    /(conclu|aprov|tratad|monitor|fechad|resolv|finaliz|sucess|valid|ok|ativ_ok)/.test(v)
  )
    return { tone: 'success' };

  // Categoria/tipo neutro
  if (/(rascunh|identific|nao_avaliad)/.test(v)) return { tone: 'neutral' };

  return { tone: 'neutral' };
};
