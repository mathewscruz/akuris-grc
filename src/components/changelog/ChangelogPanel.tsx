import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/i18n-format';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { AkurisAIIcon } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronRight, Sparkles } from 'lucide-react';

export interface ChangelogItem {
  type: 'feature' | 'improvement' | 'fix';
  text: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  items: ChangelogItem[];
  created_at: string;
}

const SEEN_KEY = 'changelog_last_seen_version';

const TYPE_TONE: Record<ChangelogItem['type'], StatusTone> = {
  feature: 'primary',
  improvement: 'info',
  fix: 'warning',
};

const getLastSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

/** Feed de novidades partilhado pelo sino unificado do header. */
export function useChangelogFeed() {
  const [lastSeen, setLastSeen] = useState<string | null>(() => getLastSeen());

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['changelog-entries'],
    queryFn: async (): Promise<ChangelogEntry[]> => {
      const { data, error } = await supabase
        .from('changelog_entries')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(10);

      if (error) return [];
      return (data || []).map((d: any) => ({
        ...d,
        items: Array.isArray(d.items) ? d.items : [],
      }));
    },
    staleTime: 10 * 60 * 1000,
  });

  const hasNew = entries.length > 0 && entries[0].version !== lastSeen;

  const markSeen = () => {
    if (entries.length === 0) return;
    try {
      localStorage.setItem(SEEN_KEY, entries[0].version);
    } catch {
      /* storage indisponível */
    }
    setLastSeen(entries[0].version);
  };

  return { entries, loading: isLoading, hasNew, markSeen };
}

interface ChangelogPanelProps {
  entries: ChangelogEntry[];
  loading: boolean;
  /** Fecha o popover do sino quando o detalhe abre. */
  onOpenDetail?: () => void;
}

export function ChangelogPanel({ entries, loading, onOpenDetail }: ChangelogPanelProps) {
  const { t, locale } = useLanguage();
  const [detail, setDetail] = useState<ChangelogEntry | null>(null);

  const typeLabel = (type: ChangelogItem['type']) => {
    if (type === 'feature') return t('changelog.feature');
    if (type === 'improvement') return t('changelog.improvement');
    return t('changelog.fix');
  };

  const openDetail = (entry: ChangelogEntry) => {
    setDetail(entry);
    onOpenDetail?.();
  };

  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <AkurisPulse size={40} />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/50 text-muted-foreground mb-3">
            <Sparkles className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <p className="text-xs text-muted-foreground">{t('changelog.noUpdates')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {entries.map((entry) => {
            const counts = entry.items.reduce<Record<string, number>>((acc, it) => {
              acc[it.type] = (acc[it.type] || 0) + 1;
              return acc;
            }, {});
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => openDetail(entry)}
                className="group w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-primary tracking-tight">
                        {entry.version}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatDate(entry.release_date + 'T00:00:00', locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-foreground leading-tight tracking-tight">
                      {entry.items[0]?.text || t('changelog.whatsNew')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(['feature', 'improvement', 'fix'] as const).map((type) =>
                        counts[type] ? (
                          <StatusBadge key={type} size="sm" tone={TYPE_TONE[type]}>
                            {counts[type]} {typeLabel(type)}
                          </StatusBadge>
                        ) : null
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 shrink-0"
                    strokeWidth={1.5}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary"
                  >
                    <AkurisAIIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 leading-none">
                      {t('changelog.title')}
                    </p>
                    <DialogTitle className="mt-1.5 text-base font-semibold leading-tight tracking-tight">
                      <span className="font-mono text-primary mr-2">{detail.version}</span>
                      <span className="text-foreground">·</span>
                      <span className="ml-2 text-foreground/80 text-sm font-medium">
                        {formatDate(detail.release_date + 'T00:00:00', locale)}
                      </span>
                    </DialogTitle>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-2 max-h-[55vh] overflow-y-auto">
                <ul className="space-y-3">
                  {detail.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/40 p-3">
                      <StatusBadge size="sm" tone={TYPE_TONE[item.type]} className="mt-0.5 shrink-0">
                        {typeLabel(item.type)}
                      </StatusBadge>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words flex-1">
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  {t('changelog.close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
