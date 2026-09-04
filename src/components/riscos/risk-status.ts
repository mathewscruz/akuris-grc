/**
 * Coerência do status do risco × tratamentos (AKURIS QA-065).
 *
 * Um risco só é "Tratado" quando existe ao menos um tratamento exigido e todos
 * os tratamentos exigidos estão concluídos. Seeds antigos gravaram
 * `status = 'tratado'` sem nenhum tratamento (`0/0`), o que a tela exibia como
 * verdade.
 *
 * Duas frentes, propositalmente separadas:
 * - LEITURA  (`deriveRiscoStatus`): deriva o status coerente só para exibição.
 *   Não reescreve nada no banco — registros históricos continuam intactos.
 * - ESCRITA  (`podeMarcarTratado`): bloqueia gravar 'tratado' sem tratamento
 *   concluído. A regra vive na aplicação, e não numa CHECK constraint, porque
 *   uma constraint impediria qualquer edição das linhas já inconsistentes.
 */

const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const STATUS_TRATADO = 'tratado';

export function assertTratamentosLookup(error: { message?: string } | null | undefined): void {
  if (error) {
    throw new Error(`Não foi possível verificar os tratamentos dos riscos. Tente novamente. (${error.message || 'erro desconhecido'})`);
  }
}

export interface TratamentoStatusLike {
  status?: string | null;
}

/** Resumo de tratamentos suficiente para decidir a coerência do status. */
export interface TratamentoResumo {
  /** Tratamentos exigidos (total menos os cancelados). */
  requeridos: number;
  /** Tratamentos exigidos já concluídos. */
  concluidos: number;
}

/** Tratamento concluído — aceita 'concluído', 'concluido', 'concluída', 'finalizado'. */
export function isTratamentoConcluido(status?: string | null): boolean {
  const v = norm(status);
  return v.startsWith('conclu') || v === 'finalizado' || v === 'finalizada';
}

/** Tratamento cancelado não conta como pendência nem como conclusão. */
function isTratamentoCancelado(status?: string | null): boolean {
  const v = norm(status);
  return v === 'cancelado' || v === 'cancelada';
}

/** Um tratamento é exigido enquanto não for cancelado. */
export function isTratamentoRequerido(status?: string | null): boolean {
  return !isTratamentoCancelado(status);
}

/** Reduz uma lista de tratamentos ao resumo usado pelas regras de status. */
export function resumirTratamentos(
  tratamentos: readonly TratamentoStatusLike[] | null | undefined,
): TratamentoResumo {
  const lista = tratamentos ?? [];
  const requeridos = lista.filter((t) => isTratamentoRequerido(t?.status));
  return {
    requeridos: requeridos.length,
    concluidos: requeridos.filter((t) => isTratamentoConcluido(t?.status)).length,
  };
}

/**
 * Regra única de "Tratado": pelo menos um tratamento exigido E todos concluídos.
 * Zero tratamentos → `false` (não existe risco tratado sem tratamento algum).
 */
export function podeMarcarTratado(
  tratamentos: readonly TratamentoStatusLike[] | TratamentoResumo | null | undefined,
): boolean {
  const resumo = Array.isArray(tratamentos)
    ? resumirTratamentos(tratamentos)
    : ((tratamentos as TratamentoResumo | null | undefined) ?? { requeridos: 0, concluidos: 0 });
  return resumo.requeridos > 0 && resumo.concluidos === resumo.requeridos;
}

/** Motivo acionável do bloqueio, para toast/erro de formulário. */
export function motivoBloqueioTratado(resumo: TratamentoResumo): string {
  if (resumo.requeridos === 0) {
    return 'O status "Tratado" exige ao menos um tratamento cadastrado e concluído. Cadastre o tratamento antes de mudar o status.';
  }
  const pendentes = resumo.requeridos - resumo.concluidos;
  return `O status "Tratado" exige todos os tratamentos concluídos — ${pendentes} de ${resumo.requeridos} ainda ${pendentes === 1 ? 'está pendente' : 'estão pendentes'}.`;
}

export interface StatusCoerente {
  /** Status a exibir. Igual ao armazenado, exceto quando 'tratado' é incoerente. */
  status: string;
  /** `true` quando o valor exibido difere do gravado no banco. */
  ajustado: boolean;
  /** Explicação do ajuste (tooltip/aria-label). `null` quando não houve ajuste. */
  motivo: string | null;
}

/**
 * Status coerente para exibição. Rascunho, revisão e arquivo são estados
 * explícitos. Nos demais casos, a evidência de tratamento governa o fluxo:
 * em aberto → em tratamento; todos concluídos → tratado; sem tratamento não
 * pode permanecer em tratamento/tratado.
 */
export function deriveRiscoStatus(
  statusArmazenado: string | null | undefined,
  tratamentos: readonly TratamentoStatusLike[] | TratamentoResumo | null | undefined,
): StatusCoerente {
  const original = (statusArmazenado ?? '').trim();
  const normalizado = norm(original);
  if (['rascunho', 'em_revisao', 'arquivado'].includes(normalizado)) {
    return { status: original, ajustado: false, motivo: null };
  }

  const resumo = Array.isArray(tratamentos)
    ? resumirTratamentos(tratamentos)
    : ((tratamentos as TratamentoResumo | null | undefined) ?? { requeridos: 0, concluidos: 0 });

  const esperado = podeMarcarTratado(resumo)
    ? STATUS_TRATADO
    : resumo.requeridos > 0
      ? 'em_tratamento'
      : ['tratado', 'em_tratamento'].includes(normalizado)
        ? 'analisado'
        : original;

  if (esperado === original) {
    return { status: original, ajustado: false, motivo: null };
  }

  return {
    status: esperado,
    ajustado: true,
    motivo: resumo.requeridos === 0
      ? 'O risco não possui tratamento ativo; exibindo o status coerente com a evidência.'
      : `O risco possui ${resumo.concluidos} de ${resumo.requeridos} tratamentos concluídos; exibindo o status coerente com a evidência.`,
  };
}
