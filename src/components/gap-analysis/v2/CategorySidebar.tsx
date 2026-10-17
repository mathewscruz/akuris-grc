import { useMemo, useState } from 'react';
import { IconSearch } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Category { categoria: string; filterCategory?: string; score: number; conforme: number; parcial: number; nao_conforme: number; nao_aplicavel: number; total: number }

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Categorias do framework como navegação lateral: cada item filtra a tabela de requisitos. */
export function CategorySidebar({ categories, active, onSelect, footer }: {
  categories: Category[];
  active?: string;
  onSelect: (category: string | undefined) => void;
  footer?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => categories
    .filter((c) => c.total > c.nao_aplicavel)
    .filter((c) => !busca || norm(c.categoria).includes(norm(busca))), [categories, busca]);
  const total = categories.reduce((s, c) => s + c.total - c.nao_aplicavel, 0);
  const avaliados = categories.reduce((s, c) => s + c.conforme + c.parcial + c.nao_conforme, 0);

  const Item = ({ id, label, done, of, score }: { id: string | undefined; label: string; done: number; of: number; score: number | null }) => {
    const ativo = (active || undefined) === id;
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={ativo ? 'true' : undefined}
        className={cn(
          'group w-full rounded-lg px-3 py-2.5 text-left transition-colors',
          ativo ? 'bg-primary/10' : 'hover:bg-accent',
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn('text-sm leading-snug', ativo ? 'font-semibold text-primary' : 'font-medium text-foreground')}>{label}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{done}/{of}</span>
        </span>
        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className={cn('block h-full rounded-full transition-[width] duration-500', ativo ? 'bg-primary' : 'bg-primary/60')}
            style={{ width: `${score ?? 0}%` }}
          />
        </span>
      </button>
    );
  };

  return (
    <aside className="rounded-lg border border-border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col" data-keep-frame>
      <header className="px-4 pt-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{t('executive.categories')}</h2>
        <p className="text-xs text-muted-foreground">{t('gapUi.sidebar.count', { n: lista.length })}</p>
        <label className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 h-8">
          <IconSearch className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t('gapUi.sidebar.search')}
            aria-label={t('gapUi.sidebar.search')}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        <Item id={undefined} label={t('gapUi.sidebar.all')} done={avaliados} of={total} score={total ? Math.round((avaliados / total) * 100) : 0} />
        {lista.map((c, n) => {
          const done = c.conforme + c.parcial + c.nao_conforme;
          return <Item key={c.categoria} id={c.filterCategory ?? c.categoria} label={`${n + 1}. ${c.categoria}`} done={done} of={c.total - c.nao_aplicavel} score={done ? c.score : null} />;
        })}
      </nav>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </aside>
  );
}
