/**
 * Utilidades de UUID (AKURIS QA-064).
 *
 * Colunas legadas como `riscos.responsavel` e `riscos_tratamentos.responsavel`
 * são TEXT e guardam tanto UUIDs (`profiles.user_id`) quanto rótulos textuais
 * herdados de seeds antigos ("Mathews Cruz - CISO", "TI Operações", "DPO").
 * Enviar esses rótulos para um filtro de coluna `uuid` no PostgREST devolve
 * HTTP 400 / `22P02 invalid input syntax for type uuid`.
 *
 * Regra do módulo: nunca consultar `profiles.user_id` com valor que não seja
 * UUID; o rótulo textual continua disponível para exibição.
 */

/** UUID canônico (8-4-4-4-12), qualquer versão/variante. Case-insensitive. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` somente para uma string que o Postgres aceita como `uuid`. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Mantém apenas UUIDs válidos e remove duplicatas — pronto para `.in('user_id', …)`.
 * Retorna `[]` quando não sobra nenhum, permitindo pular a consulta por completo.
 */
export function filterUuids(values: readonly unknown[] | null | undefined): string[] {
  if (!values) return [];
  const out = new Set<string>();
  for (const v of values) {
    if (isUuid(v)) out.add(v.trim());
  }
  return [...out];
}

/**
 * Separa um valor de responsável legado: UUID de perfil vs. rótulo textual.
 * O rótulo é preservado para exibição (nunca é enviado ao backend como UUID).
 */
export function splitResponsavel(value?: string | null): { userId: string | null; label: string | null } {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { userId: null, label: null };
  return isUuid(raw) ? { userId: raw, label: null } : { userId: null, label: raw };
}
