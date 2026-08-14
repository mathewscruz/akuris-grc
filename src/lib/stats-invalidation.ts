import type { QueryClient } from '@tanstack/react-query';

/**
 * Envio 14 · defeito 3 — a faixa de estatística não atualizava depois de criar,
 * editar ou eliminar um registo.
 *
 * Cada módulo já invalida a sua query de lista depois de uma mutação (por isso a
 * tabela atualiza logo). As queries de estatística vivem numa chave própria
 * (`*-stats`) e ficavam de fora. Em vez de repetir a invalidação em cada módulo
 * (o que volta sempre a ser esquecido por componentes novos), ligamos aqui uma
 * regra global: sempre que qualquer query for invalidada, invalidamos também as
 * queries de estatística. Um único ponto, sem regressões possíveis.
 */
const isStatsKey = (key: readonly unknown[]): boolean =>
  typeof key[0] === 'string' && key[0].endsWith('-stats');

export function installStatsInvalidation(queryClient: QueryClient): () => void {
  const cache = queryClient.getQueryCache();

  return cache.subscribe((event) => {
    if (event.type !== 'updated') return;
    if ((event.action as { type?: string })?.type !== 'invalidate') return;
    // Evita ciclo: invalidar estatísticas não volta a disparar a regra.
    if (isStatsKey(event.query.queryKey)) return;

    queryClient.invalidateQueries({
      predicate: (q) => isStatsKey(q.queryKey),
    });
  });
}
