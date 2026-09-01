import React from 'react';
import type { StatusTone, StatusIntensity } from '@/components/ui/status-badge';

/**
 * O estado é ponto e cor, nunca ícone.
 *
 * Havia 59 estados a devolver um ícone próprio e 98 a devolver nada, o que
 * punha a MESMA coluna a alternar entre um ponto cheio de 6px e um ícone de
 * contorno de 11px conforme a linha. Era isso que se lia como "bolinha
 * diferente": não eram dois pontos distintos, era um ponto e um ícone.
 *
 * Além de inconsistente, um glifo de contorno dentro de um chip de 19px lê-se
 * mal, e uma coluna com doze desenhos diferentes não se lê de todo. O peso da
 * distinção fica onde funciona: na cor e no rótulo.
 */
export interface ToneResult {
  tone: StatusTone;
  intensity?: StatusIntensity;
  /** Letra redundante à cor (WCAG 1.4.1): C/A/M/B na escala de severidade. */
  mark?: string;
  /**
   * `type` marca TAXONOMIA — o que a coisa é, e não em que estado está.
   *
   * O chip dessa família é texto, não pílula. Um "Preventivo" ou um
   * "Procedimento" não pedem decisão nenhuma a quem lê a lista, e gastavam
   * cor e forma que fazem falta ao estado e à severidade.
   */
  family?: 'type';
}

/** Envolve um resolver existente para o marcar como taxonomia. */
const comoTaxonomia =
  (resolver: (raw?: string | null) => ToneResult) =>
  (raw?: string | null): ToneResult => ({ ...resolver(raw), family: 'type' });

/** Normaliza string (remove acentos + lowercase + trim). */
const norm = (raw?: string | null): string =>
  (raw ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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
      return { tone: 'success' };
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
      return { tone: 'destructive', intensity: 'high' };
    case 'a vencer':
    case 'a_vencer':
    case 'em renovacao':
    case 'em_renovacao':
    case 'em rotacao':
    case 'em_rotacao':
      return { tone: 'warning' };
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
      return { tone: 'success' };
    case 'negociacao':
      return { tone: 'warning' };
    case 'aprovacao':
      return { tone: 'info' };
    case 'suspenso':
      return { tone: 'warning' };
    case 'encerrado':
    case 'cancelado':
      return { tone: 'destructive' };
    case 'rascunho':
    case 'inativo':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Controles: tipo (preventivo, detectivo, corretivo) — categoria, sem alarme
// ─────────────────────────────────────────────────────────────────────────────
const _resolveControleTipoTone = (raw?: string | null): ToneResult => {
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
/**
 * Classificação de confidencialidade.
 *
 * Só o que impõe cuidado no manuseio fica em pílula: `confidencial` e
 * `restrita`. "Interna" e "pública" passam a texto — eram a classificação da
 * esmagadora maioria dos documentos, e pintá-las gastava o alarme na
 * normalidade: quando tudo tem cor, o confidencial não salta.
 */
export const resolveClassificacaoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'confidencial':
      return { tone: 'destructive', intensity: 'high' };
    case 'restrita':
      return { tone: 'warning' };
    default:
      return { tone: 'neutral', family: 'type' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Denúncias: status (nova, em_analise, em_investigacao, resolvida, arquivada)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveDenunciaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'nova':
      return { tone: 'info' };
    case 'em analise':
    case 'em_analise':
      return { tone: 'warning' };
    case 'em investigacao':
    case 'em_investigacao':
      return { tone: 'warning', intensity: 'high' };
    case 'resolvida':
    case 'resolvido':
      return { tone: 'success' };
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
      return { tone: 'destructive', intensity: 'high' };
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
      return { tone: 'info' };
    case 'em andamento':
    case 'em_andamento':
    case 'em analise':
    case 'em_analise':
      return { tone: 'info' };
    case 'aguardando aprovacao':
    case 'aguardando_aprovacao':
    case 'pendente':
    case 'pendente_aprovacao':
      return { tone: 'warning' };
    case 'concluido':
    case 'concluida':
    case 'resolvido':
    case 'resolvida':
    case 'fechado':
    case 'fechada':
      return { tone: 'success' };
    case 'cancelado':
    case 'cancelada':
      return { tone: 'destructive' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Documentos: tipo (documento, politica, procedimento, instrucao, formulario,
// certificado, contrato, relatorio) — categoria neutra com tons rotativos
// ─────────────────────────────────────────────────────────────────────────────
const _resolveTipoDocumentoTone = (raw?: string | null): ToneResult => {
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
/**
 * Escala de severidade ÚNICA (heatmap) — mesma cor em todo o sistema para
 * criticidade, prioridade, gravidade, severidade e nível de risco.
 * 🔴 Crítico (destructive) · 🟠 Alto (orange) · 🟡 Médio (warning) · 🟢 Baixo (success).
 * Todos os resolvers de severidade abaixo delegam para cá.
 */
export const resolveSeverityTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  if (v === 'critico' || v === 'critica' || v === 'muito alto' || v === 'muito_alto')
    return { tone: 'destructive', intensity: 'high', mark: 'C' };
  if (v === 'alto' || v === 'alta') return { tone: 'orange', mark: 'A' };
  if (v === 'medio' || v === 'media') return { tone: 'warning', mark: 'M' };
  if (v === 'baixo' || v === 'baixa' || v === 'muito baixo' || v === 'muito_baixo')
    return { tone: 'success', mark: 'B' };
  if (v === 'informativa' || v === 'informativo' || v === 'info') return { tone: 'info', mark: 'I' };
  return { tone: 'neutral' };
};

/**
 * A cor de um score de due diligence — um sítio, para os três que o mostram.
 *
 * ## O que estava
 *
 * O crachá saía CINZENTO na faixa mais comum. `StatusBadge` tem duas famílias:
 * `state` (repouso/atenção/bloqueado/feito) e `severity` (crítico/alto/médio/
 * baixo). Sem `mark`, desenha-se como ESTADO — e ali `info` mapeia para
 * `rest`, que é cinzento de propósito, porque num estado «info» quer dizer
 * «nada a fazer». Um score de 62,5% saía com a mesma cor de um campo vazio.
 *
 * E não era só a cor: a lista de FORNECEDORES usava três faixas (80/60) e a de
 * AVALIAÇÕES usava quatro (80/60/40). O mesmo fornecedor mudava de cor
 * conforme o ecrã em que era visto.
 *
 * ## O que fica
 *
 * A família de severidade, que tem as quatro cores e leva uma MARCA — a letra
 * que impede a cor de ser o único sinal (WCAG 1.4.1), como já acontece no
 * mapa de risco com C/A/M/B.
 *
 * A marca é uma nota de A a D, e não a inicial do rótulo: «Regular» e «Ruim»
 * começam ambas por R, e a letra tem de distinguir. A–D lê-se em qualquer
 * língua e já traz a ordem consigo.
 *
 * A escala é a INVERSA da severidade, e é de propósito: aqui o número alto é o
 * bom. 80+ verde, 60+ amarelo, 40+ laranja, abaixo disso vermelho — a rampa
 * que se lê de relance, com o número ao lado para quem quiser o detalhe.
 */
export const resolveScoreDueDiligenceTone = (score?: number | null): ToneResult => {
  if (score === null || score === undefined || Number.isNaN(score)) return { tone: 'neutral' };
  if (score >= 80) return { tone: 'success', mark: 'A' };
  if (score >= 60) return { tone: 'warning', mark: 'B' };
  if (score >= 40) return { tone: 'orange', mark: 'C' };
  return { tone: 'destructive', intensity: 'high', mark: 'D' };
};

export const resolveAuditoriaPrioridadeTone = resolveSeverityTone;

export const resolveAuditoriaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'planejamento':
    case 'planejada':
      return { tone: 'warning' };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info' };
    case 'concluida':
    case 'concluido':
      return { tone: 'success' };
    case 'cancelada':
    case 'cancelado':
      return { tone: 'destructive' };
    default:
      return { tone: 'neutral' };
  }
};

const _resolveAuditoriaTipoTone = (raw?: string | null): ToneResult => {
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
      return { tone: 'neutral' };
    case 'analisado':
    case 'em analise':
    case 'em_analise':
      return { tone: 'info' };
    case 'tratado':
      return { tone: 'success' };
    case 'monitorado':
      return { tone: 'success' };
    case 'aceito':
      return { tone: 'warning' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Riscos: nível (escala de severidade)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveNivelRiscoTone = resolveSeverityTone;

// ─────────────────────────────────────────────────────────────────────────────
// Tratamentos: tipo (categoria funcional)
// ─────────────────────────────────────────────────────────────────────────────
const _resolveTratamentoTipoTone = (raw?: string | null): ToneResult => {
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
      return { tone: 'neutral' };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info' };
    case 'concluido':
      return { tone: 'success' };
    case 'cancelado':
      return { tone: 'destructive' };
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
      return { tone: 'neutral' };
    case 'ativo':
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info' };
    case 'concluido':
      return { tone: 'success' };
    case 'expirado':
      return { tone: 'destructive' };
    case 'pausado':
      return { tone: 'warning' };
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
      return { tone: 'success' };
    case 'rejeitado':
      return { tone: 'destructive' };
    case 'pendente':
    // O vocabulario do produto para "a aguardar aprovacao" e
    // `pendente_aprovacao` — e o que a restricao CHECK de `riscos` aceita e o
    // que Documentos e Contas Privilegiadas gravam.
    case 'pendente_aprovacao':
      return { tone: 'warning' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Revisão por dias (vencida, próxima, ok)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveRevisaoTone = (diasParaRevisao: number): ToneResult => {
  if (diasParaRevisao < 0) return { tone: 'destructive' };
  if (diasParaRevisao <= 7) return { tone: 'warning' };
  if (diasParaRevisao <= 30) return { tone: 'info' };
  return { tone: 'success' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Severidade (vulnerabilidades, incidentes)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveSeveridadeTone = resolveSeverityTone;

// ─────────────────────────────────────────────────────────────────────────────
// Controles: status (ativo, inativo, em_revisao, descontinuado)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveControleStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'ativo':
      return { tone: 'success' };
    case 'inativo':
      return { tone: 'neutral' };
    case 'em revisao':
    case 'em_revisao':
      return { tone: 'warning' };
    case 'descontinuado':
      return { tone: 'destructive' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Criticidade (controles, ativos)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveCriticidadeTone = resolveSeverityTone;

// ─────────────────────────────────────────────────────────────────────────────
// Auditoria: status do item (pendente, em_andamento, concluido, nao_aplicavel)
// ─────────────────────────────────────────────────────────────────────────────
export const resolveItemAuditoriaStatusTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'pendente':
      return { tone: 'neutral' };
    case 'em andamento':
    case 'em_andamento':
      return { tone: 'info' };
    case 'concluido':
      return { tone: 'success' };
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
const _resolveCategoriaTone = (raw?: string | null): ToneResult => {
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
const _resolveQuestionTypeTone = (raw?: string | null): ToneResult => {
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
      return { tone: 'warning' };
    case 'concluido':
      return { tone: 'success' };
    case 'atrasado':
      return { tone: 'destructive', intensity: 'high' };
    case 'cancelado':
      return { tone: 'neutral' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Contratos: tipo de marco (categoria — tons distintos sem alarme)
// ─────────────────────────────────────────────────────────────────────────────
const _resolveMarcoTipoTone = (raw?: string | null): ToneResult => {
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
      return { tone: 'success' };
    case 'parcial':
      return { tone: 'warning' };
    case 'nao conforme':
    case 'nao_conforme':
      return { tone: 'destructive' };
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
  if (ativo) return { tone: 'success' };
  return { tone: 'neutral' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Acessos privilegiados: tipo de acesso (leitura, escrita, admin, completo)
// ─────────────────────────────────────────────────────────────────────────────
const _resolveTipoAcessoTone = (raw?: string | null): ToneResult => {
  const v = norm(raw);
  switch (v) {
    case 'leitura':
      return { tone: 'info' };
    case 'escrita':
      return { tone: 'success' };
    case 'admin':
      return { tone: 'warning' };
    case 'completo':
      return { tone: 'destructive', intensity: 'high' };
    default:
      return { tone: 'neutral' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Documentos: tipo de vinculação (categoria semântica)
// ─────────────────────────────────────────────────────────────────────────────
const _resolveTipoVinculacaoTone = (raw?: string | null): ToneResult => {
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
const _resolveGenericTone = (raw?: string | null): ToneResult => {
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


/*
  Taxonomia: o que a coisa é, não o estado em que está.

  Estes resolvers continuam a calcular o mesmo tom — a família é que diz ao
  `Chip` para o desenhar como texto em vez de pílula.
*/
export const resolveControleTipoTone = comoTaxonomia(_resolveControleTipoTone);
export const resolveTipoDocumentoTone = comoTaxonomia(_resolveTipoDocumentoTone);
export const resolveAuditoriaTipoTone = comoTaxonomia(_resolveAuditoriaTipoTone);
export const resolveTratamentoTipoTone = comoTaxonomia(_resolveTratamentoTipoTone);
export const resolveCategoriaTone = comoTaxonomia(_resolveCategoriaTone);
export const resolveQuestionTypeTone = comoTaxonomia(_resolveQuestionTypeTone);
export const resolveMarcoTipoTone = comoTaxonomia(_resolveMarcoTipoTone);
export const resolveTipoAcessoTone = comoTaxonomia(_resolveTipoAcessoTone);
export const resolveTipoVinculacaoTone = comoTaxonomia(_resolveTipoVinculacaoTone);
export const resolveGenericTone = comoTaxonomia(_resolveGenericTone);
