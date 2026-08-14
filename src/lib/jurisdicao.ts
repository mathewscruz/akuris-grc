/**
 * Camada regulatória configurável (Defeito 6 — P1 envio 2).
 *
 * A plataforma serve Brasil (LGPD), Portugal / União Europeia (RGPD) e
 * mercados de língua inglesa (GDPR). Nada relacionado com a lei de proteção
 * de dados pode estar escrito a martelo: tudo é derivado da jurisdição
 * configurada na empresa (`empresas.jurisdicao`).
 */

export type JurisdicaoCodigo = 'BR' | 'PT_EU' | 'INTL';

export const JURISDICOES: JurisdicaoCodigo[] = ['BR', 'PT_EU', 'INTL'];

export interface JurisdicaoConfig {
  codigo: JurisdicaoCodigo;
  /** Designação curta da lei (LGPD / RGPD / GDPR). */
  lei: string;
  /** Sigla da autoridade de controlo (ANPD / CNPD / —). */
  autoridade: string;
  /** Chave i18n com o nome por extenso da autoridade. */
  autoridadeKey: string;
  /** Prazo legal de resposta ao titular, em dias. */
  prazoTitularDias: number;
  /** Chave i18n com a descrição legal do prazo de resposta. */
  prazoTitularKey: string;
  /** Chave i18n com o prazo de notificação de violação de dados. */
  prazoViolacaoKey: string;
  /** Chave i18n com a base legal citada (artigo). */
  artigoTitularKey: string;
}

export const JURISDICAO_CONFIG: Record<JurisdicaoCodigo, JurisdicaoConfig> = {
  BR: {
    codigo: 'BR',
    lei: 'LGPD',
    autoridade: 'ANPD',
    autoridadeKey: 'jurisdicao.autoridades.anpd',
    prazoTitularDias: 15,
    prazoTitularKey: 'jurisdicao.prazos.titular.br',
    prazoViolacaoKey: 'jurisdicao.prazos.violacao.br',
    artigoTitularKey: 'jurisdicao.artigos.titular.br',
  },
  PT_EU: {
    codigo: 'PT_EU',
    lei: 'RGPD',
    autoridade: 'CNPD',
    autoridadeKey: 'jurisdicao.autoridades.cnpd',
    prazoTitularDias: 30,
    prazoTitularKey: 'jurisdicao.prazos.titular.ptEu',
    prazoViolacaoKey: 'jurisdicao.prazos.violacao.ptEu',
    artigoTitularKey: 'jurisdicao.artigos.titular.ptEu',
  },
  INTL: {
    codigo: 'INTL',
    lei: 'GDPR',
    autoridade: '',
    autoridadeKey: 'jurisdicao.autoridades.intl',
    prazoTitularDias: 30,
    prazoTitularKey: 'jurisdicao.prazos.titular.intl',
    prazoViolacaoKey: 'jurisdicao.prazos.violacao.intl',
    artigoTitularKey: 'jurisdicao.artigos.titular.intl',
  },
};

/** Direitos do titular, por jurisdição (chaves i18n). */
export const DIREITOS_TITULAR: Record<JurisdicaoCodigo, string[]> = {
  BR: ['confirmacao', 'acesso', 'correcao', 'anonimizacao', 'portabilidade', 'eliminacao', 'informacao', 'revogacao'],
  PT_EU: ['acesso', 'retificacao', 'apagamento', 'limitacao', 'portabilidade', 'oposicao', 'decisaoAutomatizada'],
  INTL: ['acesso', 'retificacao', 'apagamento', 'limitacao', 'portabilidade', 'oposicao', 'decisaoAutomatizada'],
};

/**
 * Inferência por omissão a partir do idioma da conta, do idioma do browser e
 * do fuso horário/domínio. Só é usada quando a empresa ainda não configurou.
 */
export function inferirJurisdicao(locale?: string): JurisdicaoCodigo {
  const langs: string[] = [];
  if (locale) langs.push(locale);
  if (typeof navigator !== 'undefined') {
    langs.push(...(navigator.languages || []), navigator.language || '');
  }
  const lower = langs.filter(Boolean).map((l) => l.toLowerCase());

  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    timeZone = '';
  }

  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  if (host.endsWith('.br') || host.endsWith('.com.br')) return 'BR';
  if (host.endsWith('.pt')) return 'PT_EU';

  if (lower.some((l) => l.startsWith('pt-br'))) return 'BR';
  if (lower.some((l) => l.startsWith('pt-pt'))) return 'PT_EU';

  if (timeZone.startsWith('America/')) return lower.some((l) => l.startsWith('pt')) ? 'BR' : 'INTL';
  if (timeZone === 'Europe/Lisbon' || timeZone === 'Atlantic/Azores' || timeZone === 'Atlantic/Madeira') return 'PT_EU';
  if (timeZone.startsWith('Europe/')) return lower.some((l) => l.startsWith('pt')) ? 'PT_EU' : 'INTL';

  if (lower.some((l) => l.startsWith('pt'))) return 'PT_EU';
  return 'INTL';
}

/** Data limite de resposta a uma solicitação de titular, segundo a jurisdição. */
export function prazoResposta(dataAbertura: string | Date, codigo: JurisdicaoCodigo): Date {
  const base = typeof dataAbertura === 'string' ? new Date(dataAbertura) : new Date(dataAbertura.getTime());
  const dias = JURISDICAO_CONFIG[codigo].prazoTitularDias;
  base.setDate(base.getDate() + dias);
  return base;
}

/** Última jurisdição conhecida — para helpers puros (PDF/exportações). */
let jurisdicaoAtual: JurisdicaoCodigo = 'PT_EU';
export function setJurisdicaoAtual(codigo: JurisdicaoCodigo) {
  jurisdicaoAtual = codigo;
}
export function getJurisdicaoAtual(): JurisdicaoCodigo {
  return jurisdicaoAtual;
}
