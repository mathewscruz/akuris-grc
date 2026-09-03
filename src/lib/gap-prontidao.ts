/**
 * O que ainda falta antes de chamar o auditor.
 *
 * O módulo respondia bem a «onde estou» (o índice), a «por onde começo» (as
 * fases e a fila) e a «o que é isto» (a orientação). Não respondia à última
 * pergunta, que para quem nunca fez isto é a mais aflitiva: **já posso marcar?**
 *
 * Quem contrata uma consultoria tem alguém que diz «ainda não» ou «pode ir». Um
 * produto que se vende como substituto disso não pode deixar a pessoa a olhar
 * para 87% sem saber se 87% chega. E não chega: numa ISO, um único requisito
 * aplicável por cumprir reprova o Estágio 2.
 *
 * ## O que isto NÃO é
 *
 * Não é um score. O módulo já teve três fórmulas paralelas de aderência e uma
 * guarda dedicada a impedir a quarta — esta função conta bloqueios, não pontua
 * nada, e recebe exactamente as contagens que alimentam o mapa de calor e o
 * painel de fases.
 *
 * Também não é uma promessa de aprovação. O produto vê o que está registado
 * nele; a qualidade da prova é juízo do auditor. O ecrã diz isso por extenso —
 * dizer «está pronto» sem essa ressalva seria o género de afirmação que este
 * produto existe para não fazer.
 */
import type { FimDoPercurso } from './gap-fases';

/** As contagens por categoria, como o ecrã já as tem. */
export interface ContagemDaCategoria {
  conforme: number;
  parcial: number;
  nao_conforme: number;
  nao_aplicavel: number;
  nao_avaliado: number;
  total: number;
}

/** Um motivo para ainda não se poder marcar a auditoria. */
export interface Bloqueio {
  /** `nao_avaliado` | `nao_conforme` | `parcial` — a chave do estado. */
  chave: 'nao_avaliado' | 'nao_conforme' | 'parcial';
  quantos: number;
}

export interface Prontidao {
  /** Requisitos que contam: o total menos o que o SoA pôs fora do escopo. */
  aplicaveis: number;
  /** Requisitos aplicáveis já conformes. */
  conformes: number;
  /** O que falta, do mais grave para o menos. Vazio significa pronto. */
  bloqueios: Bloqueio[];
  /** Nada por avaliar, nada não conforme, nada parcial. */
  pronto: boolean;
}

/**
 * A ordem dos bloqueios não é alfabética nem por quantidade.
 *
 * Primeiro o que a pessoa NÃO SABE — um requisito por avaliar é uma pergunta
 * sem resposta, e não se marca auditoria sem saber onde se está. Depois o que
 * está errado, e por fim o que está a meio.
 */
const ORDEM: Bloqueio['chave'][] = ['nao_avaliado', 'nao_conforme', 'parcial'];

export function prontidaoDoFramework(categorias: ContagemDaCategoria[]): Prontidao {
  const soma = (campo: keyof ContagemDaCategoria) =>
    categorias.reduce((s, c) => s + (Number(c[campo]) || 0), 0);

  const aplicaveis = soma('total') - soma('nao_aplicavel');
  const bloqueios = ORDEM.map((chave) => ({ chave, quantos: soma(chave) })).filter(
    (b) => b.quantos > 0,
  );

  return {
    aplicaveis,
    conformes: soma('conforme'),
    bloqueios,
    /*
       Um framework sem requisitos aplicáveis não está pronto — está vazio.
       Sem esta condição, quem excluísse tudo no assistente de escopo lia
       «pode marcar a auditoria» com zero requisitos por cumprir.
    */
    pronto: aplicaveis > 0 && bloqueios.length === 0,
  };
}

/**
 * O que a pessoa faz a seguir, quando está pronta.
 *
 * Depende da família, e não é detalhe: dizer a quem trabalha a LGPD «contrate
 * um organismo certificador» é mandá-la procurar uma coisa que não existe. A
 * distinção já está desenhada em `fimDoPercurso`; aqui só se escolhe a chave
 * do texto para não haver uma segunda tabela a discordar da primeira.
 */
export const chaveDoDesfecho = (fim: FimDoPercurso) => `gapProntidao.pronto_${fim}` as const;
