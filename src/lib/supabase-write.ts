/**
 * Envolve uma escrita do Supabase para que a falha deixe de ser silenciosa.
 *
 * O cliente do Supabase **não lança**: devolve `{ data, error }`. Por isso
 * `await supabase.from('x').delete().eq(...)` dentro de um `try` nunca cai no
 * `catch`, e o `toast.success` a seguir dispara mesmo quando a base recusou.
 * Trinta e três escritas do produto estavam assim — o utilizador via "guardado"
 * e nada tinha sido guardado.
 *
 * `exigirEscrita` devolve o mesmo resultado, mas lança quando há erro, de modo
 * que o `catch`/`onError` que já existe passa a receber a falha.
 *
 * LIMITE, que é preciso ter presente: um UPDATE ou DELETE recusado pela RLS
 * **não devolve erro** — a policy filtra as linhas e a operação afeta zero.
 * Para esses casos é preciso `.select()` e contar o que voltou; ver
 * `exigirLinhas`.
 */
import type { PostgrestError } from '@supabase/supabase-js';

interface Resultado {
  error: PostgrestError | null;
}

export async function exigirEscrita<T extends Resultado>(op: PromiseLike<T>): Promise<T> {
  const r = await op;
  if (r.error) throw r.error;
  return r;
}

/**
 * Para UPDATE/DELETE em que zero linhas afetadas significa recusa silenciosa da
 * RLS — e não "não havia nada para apagar". Exige `.select()` na cadeia.
 *
 *   await exigirLinhas(supabase.from('x').delete().eq('id', id).select('id'));
 */
export async function exigirLinhas<T extends Resultado & { data: unknown[] | null }>(
  op: PromiseLike<T>,
  mensagem = 'A operação não alterou nenhum registo — pode não ter permissão.',
): Promise<T> {
  const r = await op;
  if (r.error) throw r.error;
  if (!r.data || r.data.length === 0) throw new Error(mensagem);
  return r;
}
