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
  chave: 'nao_avaliado' | 'nao_conforme' | 'parcial' | 'conforme_sem_prova';
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
const ORDEM: Array<'nao_avaliado' | 'nao_conforme' | 'parcial'> = [
  'nao_avaliado',
  'nao_conforme',
  'parcial',
];

/**
 * `conformesSemProva` é `null` quando não se conseguiu contar.
 *
 * É o bloqueio mais perigoso de errar nos dois sentidos. Omiti-lo deixa o
 * produto dizer «pode marcar a auditoria» a quem tem 121 requisitos conformes e
 * zero ficheiros — e é isso que reprova uma auditoria: o auditor não avalia o
 * que a empresa afirma, avalia o que ela mostra. Mas inventá-lo por uma
 * consulta ter falhado acusa de negligência quem anexou tudo. Por isso `null`
 * não é zero: com `null`, o bloqueio simplesmente não existe.
 */
export function somarCategorias(categorias: ContagemDaCategoria[]): ContagemDaCategoria {
  const soma = (campo: keyof ContagemDaCategoria) =>
    categorias.reduce((s, c) => s + (Number(c[campo]) || 0), 0);
  return {
    conforme: soma('conforme'),
    parcial: soma('parcial'),
    nao_conforme: soma('nao_conforme'),
    nao_aplicavel: soma('nao_aplicavel'),
    nao_avaliado: soma('nao_avaliado'),
    total: soma('total'),
  };
}

export function prontidaoDoFramework(
  totais: ContagemDaCategoria | ContagemDaCategoria[],
  conformesSemProva: number | null = null,
): Prontidao {
  const t = Array.isArray(totais) ? somarCategorias(totais) : totais;

  const aplicaveis = t.total - t.nao_aplicavel;
  const bloqueios: Bloqueio[] = ORDEM.map((chave) => ({ chave, quantos: t[chave] })).filter(
    (b) => b.quantos > 0,
  );

  /* Vai no fim: é a última varredura antes de telefonar ao auditor, não a
     primeira coisa a fazer. Mas conta como bloqueio — um «conforme» sem prova
     é uma afirmação por demonstrar, e a auditoria começa exactamente aí. */
  if (conformesSemProva !== null && conformesSemProva > 0) {
    bloqueios.push({ chave: 'conforme_sem_prova', quantos: conformesSemProva });
  }

  return {
    aplicaveis,
    conformes: t.conforme,
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
