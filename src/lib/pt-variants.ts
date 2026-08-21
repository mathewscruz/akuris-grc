/**
 * Variantes do português: pt-PT (Portugal) e pt-BR (Brasil).
 *
 * O dicionário base (`src/i18n/pt.ts` + módulos) foi escrito ao longo do tempo
 * misturando vocabulário das duas variantes ("Gerencie" ao lado de "Utilizador",
 * "Excluir" ao lado de "Ficheiro"). Em vez de reescrever milhares de chaves à mão
 * — e ficar refém de cada string nova voltar a misturar —, normalizamos o
 * dicionário em tempo de arranque para cada variante:
 *
 *   dicionário base ──► toPtPT() ──► pt-PT
 *                   └─► toPtBR() ──► pt-BR
 *
 * Assim, qualquer string nova escrita em qualquer das variantes aparece coerente
 * nas duas. A transformação preserva maiúsculas/minúsculas e acontece uma única
 * vez (memoizada no LanguageContext).
 */

/** Pares canónicos: [pt-BR, pt-PT]. */
const WORD_PAIRS: Array<[string, string]> = [
  ['usuário', 'utilizador'],
  ['usuários', 'utilizadores'],
  ['arquivo', 'ficheiro'],
  ['arquivos', 'ficheiros'],
  ['excluir', 'eliminar'],
  ['excluído', 'eliminado'],
  ['excluída', 'eliminada'],
  ['excluídos', 'eliminados'],
  ['excluídas', 'eliminadas'],
  ['exclusão', 'eliminação'],
  ['buscar', 'pesquisar'],
  ['busca', 'pesquisa'],
  ['tela', 'ecrã'],
  ['telas', 'ecrãs'],
  ['gerenciar', 'gerir'],
  ['gerenciado', 'gerido'],
  ['gerenciada', 'gerida'],
  ['gerenciados', 'geridos'],
  ['gerenciadas', 'geridas'],
  ['gerenciamento', 'gestão'],
  ['cadastrar', 'registar'],
  ['cadastre', 'registe'],
  ['cadastrado', 'registado'],
  ['cadastrada', 'registada'],
  ['cadastro', 'registo'],
  ['cadastros', 'registos'],
  ['registrar', 'registar'],
  ['registrado', 'registado'],
  ['registrada', 'registada'],
  ['registrados', 'registados'],
  ['registradas', 'registadas'],
  ['registro', 'registo'],
  ['registros', 'registos'],
  // "controlo/controlos" é a forma de Portugal e escapava ao normalizador:
  // em pt-BR aparecia "frequência do controlo" no diálogo de testes.
  ['controle', 'controlo'],
  ['controles', 'controlos'],
  ['seção', 'secção'],
  ['seções', 'secções'],
  // O esquema do ROPA está escrito em pt-PT ("Partilha externa",
  // "Justificação da base legal") e não passava por aqui: o mesmo ecrã dizia
  // "Compartilhamento" no diálogo e "Partilha" no dossiê.
  ['compartilhamento', 'partilha'],
  ['compartilhamentos', 'partilhas'],
  ['compartilhar', 'partilhar'],
  ['compartilhados', 'partilhados'],
  ['compartilhadas', 'partilhadas'],
  ['justificativa', 'justificação'],
  ['justificativas', 'justificações'],
  ['salvar', 'guardar'],
  ['salvas', 'guardadas'],
  ['salvos', 'guardados'],
  /*
    O canal de denúncias trouxe vocabulário novo que escapava ao normalizador.
    Em pt-PT o ecrã dizia «Registar Denúncia» e, três linhas abaixo, «Só o
    comitê designado tem acesso» — meia frase em cada variante.
  */
  ['comitê', 'comité'],
  ['comitês', 'comités'],
  ['anônima', 'anónima'],
  ['anônimas', 'anónimas'],
  ['anônimo', 'anónimo'],
  ['anônimos', 'anónimos'],
  ['contato', 'contacto'],
  ['contatos', 'contactos'],
  ['contatar', 'contactar'],
  ['equipe', 'equipa'],
  ['equipes', 'equipas'],
  ['planejamento', 'planeamento'],
  ['planejar', 'planear'],
];

/**
 * Frases (aplicadas antes das palavras) onde a tradução exige concordância —
 * "Gerencie os riscos" ⇄ "Faça a gestão dos riscos".
 */
const PHRASE_PAIRS: Array<[string, string]> = [
  // "Partilha interna" é feminino e "Compartilhamento interno" é masculino:
  // trocar só a palavra dava "Compartilhamento interna".
  ['compartilhamento interno', 'partilha interna'],
  ['compartilhamento externo', 'partilha externa'],
  ['gerencie os ', 'faça a gestão dos '],
  ['gerencie as ', 'faça a gestão das '],
  ['gerencie o ', 'faça a gestão do '],
  ['gerencie a ', 'faça a gestão da '],
  ['gerencie ', 'faça a gestão de '],
];

/** Aplica a capitalização de `sample` a `value` (Upper, Title ou minúsculas). */
function matchCase(sample: string, value: string): string {
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return value.toUpperCase();
  if (sample[0] === sample[0]?.toUpperCase()) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Rule = { re: RegExp; to: string };

function buildRules(direction: 'br' | 'pt'): Rule[] {
  const rules: Rule[] = [];
  for (const [br, pt] of PHRASE_PAIRS) {
    const from = direction === 'br' ? pt : br;
    const to = direction === 'br' ? br : pt;
    rules.push({ re: new RegExp(escapeRegex(from), 'gi'), to });
  }
  // Palavras mais longas primeiro evita que "registro" seja apanhado por "registo".
  const pairs = [...WORD_PAIRS].sort((a, b) => b[0].length - a[0].length);
  for (const [br, pt] of pairs) {
    const from = direction === 'br' ? pt : br;
    const to = direction === 'br' ? br : pt;
    if (from === to) continue;
    rules.push({ re: new RegExp(`(?<![\\p{L}])${escapeRegex(from)}(?![\\p{L}])`, 'giu'), to });
  }
  return rules;
}

const RULES_BR = buildRules('br');
const RULES_PT = buildRules('pt');

function applyRules(text: string, rules: Rule[]): string {
  let out = text;
  for (const { re, to } of rules) {
    out = out.replace(re, (match) => matchCase(match, to));
  }
  return out;
}

/** Normaliza uma string para português do Brasil. */
export const toPtBrText = (text: string): string => applyRules(text, RULES_BR);
/** Normaliza uma string para português de Portugal. */
export const toPtPtText = (text: string): string => applyRules(text, RULES_PT);

/**
 * Ramos que citam a lei e por isso NÃO são normalizados.
 *
 * O normalizador troca palavra a palavra, sem saber o sentido. O par
 * `busca ⇄ pesquisa` está certo para onze das doze ocorrências — todas no
 * sentido de procurar — e errado justamente na décima segunda: "estudo por
 * órgão de pesquisa" é a letra do Art. 7.º, IV da LGPD, e virava "órgão de
 * busca". Terminologia legal não tem variante regional a normalizar: o texto
 * da lei é o que é.
 */
const RAMOS_LITERAIS = ['jurisdicao.basesLegais', 'jurisdicao.direitos', 'jurisdicao.artigos'];

function transformDeep(value: unknown, fn: (s: string) => string, caminho = ''): unknown {
  if (RAMOS_LITERAIS.some((r) => caminho === r || caminho.startsWith(`${r}.`))) return value;
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => transformDeep(v, fn, caminho));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformDeep(v, fn, caminho ? `${caminho}.${k}` : k);
    }
    return out;
  }
  return value;
}

/** Converte um dicionário inteiro para a variante pedida. */
export function localizePtDictionary(
  dict: Record<string, unknown>,
  variant: 'pt' | 'pt-BR',
): Record<string, unknown> {
  const fn = variant === 'pt-BR' ? toPtBrText : toPtPtText;
  return transformDeep(dict, fn) as Record<string, unknown>;
}

/**
 * Rótulo bilingue de esquema, já na variante activa.
 *
 * `ropa-schema.ts` e `ropa-percurso.ts` guardam `{ pt, en }` e são estruturas
 * de dados, não dicionários — não passavam por `localizePtDictionary`. O
 * resultado era um ecrã em pt-BR a dizer "Partilha externa" no dossiê e
 * "Compartilhamento" no diálogo ao lado, sobre o mesmo campo.
 */
export const textoDaVariante = (
  locale: string,
  par: { pt: string; en: string },
): string => {
  if (String(locale).startsWith('en')) return par.en;
  return locale === 'pt' ? toPtPtText(par.pt) : toPtBrText(par.pt);
};
