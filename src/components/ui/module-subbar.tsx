import { type ReactNode } from 'react';

/** O caminho do módulo já aparece no header; title/activeLabel/icon são aceitos mas não exibidos.
 *  Sem busca aqui: a busca local vive só na barra de filtros da tabela. */
export function ModuleSubbar({ children }: {
  title: string; activeLabel?: string; icon?: ReactNode; children: ReactNode;
}) {
  return <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 bg-background">
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}
