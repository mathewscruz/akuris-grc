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
 * Bases legais do tratamento, por jurisdição — e separadas por sensibilidade.
 *
 * Esta separação não é cosmética: é a diferença entre um registo lícito e um
 * ilícito. A LGPD trata dado comum no Art. 7 (dez hipóteses) e dado sensível
 * no Art. 11, que é uma lista DIFERENTE e mais curta — legítimo interesse,
 * execução de contrato e proteção ao crédito **não** servem para dado
 * sensível, e a prevenção à fraude só existe lá. O RGPD faz o mesmo corte
 * entre o Art. 6 e o Art. 9.
 *
 * Os formulários ofereciam uma lista única de sete opções, igual para tudo:
 * era possível gravar "Biometria — Legítimo Interesse" e o produto imprimia
 * isso na ROPA que vai para a autoridade.
 */
export const BASES_LEGAIS: Record<JurisdicaoCodigo, { comuns: string[]; sensiveis: string[] }> = {
  // LGPD: Art. 7 (dados pessoais) e Art. 11 (dados pessoais sensíveis).
  BR: {
    comuns: [
      'consentimento', 'cumprimento_obrigacao', 'politicas_publicas', 'estudo_pesquisa',
      'execucao_contrato', 'exercicio_direitos', 'protecao_vida', 'tutela_saude',
      'legitimo_interesse', 'protecao_credito',
    ],
    sensiveis: [
      'consentimento', 'cumprimento_obrigacao', 'politicas_publicas', 'estudo_pesquisa',
      'exercicio_direitos', 'protecao_vida', 'tutela_saude', 'prevencao_fraude',
    ],
  },
  // RGPD/GDPR: Art. 6 (licitude) e Art. 9.2 (categorias especiais).
  PT_EU: {
    comuns: [
      'consentimento', 'execucao_contrato', 'cumprimento_obrigacao',
      'protecao_vida', 'interesse_publico', 'legitimo_interesse',
    ],
    sensiveis: [
      'consentimento_explicito', 'obrigacao_trabalho', 'protecao_vida',
      'dados_publicos_titular', 'exercicio_direitos', 'interesse_publico_relevante',
      'tutela_saude', 'saude_publica', 'arquivo_investigacao',
    ],
  },
  INTL: {
    comuns: [
      'consentimento', 'execucao_contrato', 'cumprimento_obrigacao',
      'protecao_vida', 'interesse_publico', 'legitimo_interesse',
    ],
    sensiveis: [
      'consentimento_explicito', 'obrigacao_trabalho', 'protecao_vida',
      'dados_publicos_titular', 'exercicio_direitos', 'interesse_publico_relevante',
      'tutela_saude', 'saude_publica', 'arquivo_investigacao',
    ],
  },
};

/** Sensibilidades que o catálogo classifica como dado sensível. */
const SENSIBILIDADES_SENSIVEIS = new Set(['sensivel', 'muito_sensivel']);

export const ehDadoSensivel = (sensibilidade?: string | null): boolean =>
  SENSIBILIDADES_SENSIVEIS.has(String(sensibilidade ?? '').toLowerCase());

/**
 * Bases aplicáveis a um registo. Sem sensibilidade conhecida devolve as
 * comuns — nunca a união das duas listas, que voltaria a permitir a
 * combinação ilícita.
 */
export function basesLegaisAplicaveis(
  codigo: JurisdicaoCodigo,
  sensibilidade?: string | null,
): string[] {
  const conjunto = BASES_LEGAIS[codigo] ?? BASES_LEGAIS.BR;
  return ehDadoSensivel(sensibilidade) ? conjunto.sensiveis : conjunto.comuns;
}

/**
 * `incompativel` é o caso que interessa: a base existe na lei, mas não para
 * aquele grau de sensibilidade — é o "biometria com base em legítimo
 * interesse" que os formulários deixavam gravar. `desconhecida` é um valor
 * que a lei aplicável não prevê de todo (dado antigo, importação, mudança de
 * jurisdição). Nos dois casos o registo continua visível: esconder um dado
 * estranho num produto de conformidade é pior do que mostrá-lo marcado.
 */
export type EstadoBaseLegal = 'ok' | 'incompativel' | 'desconhecida';

export function avaliarBaseLegal(
  codigo: JurisdicaoCodigo,
  valor?: string | null,
  sensibilidade?: string | null,
): EstadoBaseLegal {
  if (!valor) return 'desconhecida';
  const conjunto = BASES_LEGAIS[codigo] ?? BASES_LEGAIS.BR;
  if (basesLegaisAplicaveis(codigo, sensibilidade).includes(valor)) return 'ok';
  const conhecidaNaJurisdicao =
    conjunto.comuns.includes(valor) || conjunto.sensiveis.includes(valor);
  return conhecidaNaJurisdicao ? 'incompativel' : 'desconhecida';
}

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
