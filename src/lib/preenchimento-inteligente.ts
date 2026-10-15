/**
 * Preenchimento inteligente (item 4 do plano "menos interações").
 *
 * Regras determinísticas que pré-preenchem formulários com os valores mais
 * prováveis. Nada aqui grava sozinho: a sugestão aparece preenchida e o
 * usuário confirma ou ajusta antes de salvar.
 *
 * Sem IA e sem créditos: prazo por prioridade e categoria pelo título são
 * regras simples, instantâneas e gratuitas.
 */

/** Normaliza para comparar: minúsculas e sem acentos (NFD). */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

}

/** Dias de prazo sugeridos por prioridade, contados de hoje. */
export const DIAS_POR_PRIORIDADE: Record<string, number> = {
  critica: 7,
  alta: 15,
  media: 30,
  baixa: 60,
};

/**
 * Sugere a data-limite (AAAA-MM-DD) conforme a prioridade. Prioridade
 * desconhecida não sugere nada — um prazo inventado é pior que nenhum.
 */
export function sugerirPrazoPorPrioridade(prioridade: string, hoje: Date = new Date()): string | null {
  const dias = DIAS_POR_PRIORIDADE[normalizarTexto(prioridade)];
  if (!dias) return null;
  const data = new Date(hoje);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Palavras que ligam o título a uma categoria. A chave é comparada com o
 * nome da categoria normalizado; as palavras, com o título normalizado.
 * Categorias da empresa entram pelo nome que já têm — sem lista fixa.
 */
const PALAVRAS_COMUNS: Record<string, string[]> = {
  seguranca: ['senha', 'acesso', 'invasao', 'malware', 'phishing', 'vazamento', 'criptografia', 'firewall', 'vulnerabilidade'],
  privacidade: ['lgpd', 'gdpr', 'dados pessoais', 'titular', 'consentimento', 'anonimizacao', 'ropa'],
  operacional: ['processo', 'operacao', 'falha humana', 'continuidade', 'fornecedor', 'terceiro'],
  tecnologia: ['sistema', 'servidor', 'nuvem', 'aws', 'backup', 'software', 'aplicacao', 'rede'],
  compliance: ['auditoria', 'regulador', 'norma', 'iso', 'soc', 'certificacao', 'legal', 'contrato'],
  financeiro: ['fraude', 'pagamento', 'financeiro', 'custo', 'orcamento'],
};

export interface CategoriaSugerivel {
  id: string;
  nome: string;
}

/**
 * Sugere a categoria mais provável para um título. Primeiro tenta o nome
 * da categoria aparecer no título; depois, as palavras comuns do tema.
 * Sem correspondência, devolve null — melhor deixar vazio do que errar.
 */
export function sugerirCategoriaPorTitulo(
  titulo: string,
  categorias: CategoriaSugerivel[],
): string | null {
  const texto = normalizarTexto(titulo);
  if (!texto || categorias.length === 0) return null;

  for (const categoria of categorias) {
    const nome = normalizarTexto(categoria.nome);
    if (nome.length >= 4 && texto.includes(nome)) return categoria.id;
  }

  for (const categoria of categorias) {
    const nome = normalizarTexto(categoria.nome);
    const tema = Object.keys(PALAVRAS_COMUNS).find((t) => nome.includes(t));
    if (!tema) continue;
    if (PALAVRAS_COMUNS[tema].some((palavra) => texto.includes(palavra))) {
      return categoria.id;
    }
  }

  return null;
}

/** Prioridade sugerida a partir da criticidade de um risco ou incidente. */
export function sugerirPrioridadePorCriticidade(criticidade: string): string | null {
  const mapa: Record<string, string> = {
    critica: 'critica',
    critico: 'critica',
    alta: 'alta',
    alto: 'alta',
    media: 'media',
    medio: 'media',
    baixa: 'baixa',
    baixo: 'baixa',
  };
  return mapa[normalizarTexto(criticidade)] ?? null;
}
