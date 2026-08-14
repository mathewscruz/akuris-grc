import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AkurisAIIcon } from '@/components/icons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/i18n-format';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronRight, Sparkles } from 'lucide-react';

interface ChangelogItem {
  type: 'feature' | 'improvement' | 'fix';
  text: string;
}

interface ChangelogEntry {
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

export function ChangelogPopover() {
  const { t, locale } = useLanguage();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const [detail, setDetail] = useState<ChangelogEntry | null>(null);
  const [open, setOpen] = useState(false);

  const typeLabel = (type: ChangelogItem['type']) => {
    if (type === 'feature') return t('changelog.feature');
    if (type === 'improvement') return t('changelog.improvement');
    return t('changelog.fix');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('changelog_entries')
          .select('*')
          .order('release_date', { ascending: false })
          .limit(10);

        if (error) {
          setEntries([]);
        } else {
          const parsed = (data || []).map((d: any) => ({
            ...d,
            items: Array.isArray(d.items) ? d.items : [],
          }));
          setEntries(parsed);

          const lastSeen = localStorage.getItem(SEEN_KEY);
          if (parsed.length > 0 && parsed[0].version !== lastSeen) {
            setHasNew(true);
          }
        }
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next && entries.length > 0) {
      localStorage.setItem(SEEN_KEY, entries[0].version);
      setHasNew(false);
    }
  };

  const openDetail = (entry: ChangelogEntry) => {
    setDetail(entry);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={t('changelog.title')}>
            <AkurisAIIcon className="h-4 w-4" />
            {hasNew && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--background))]" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[360px] max-w-[calc(100vw-2rem)] p-0 overflow-hidden border-border/60 shadow-[0_16px_40px_-10px_hsl(var(--primary)/0.18)]"
          align="end"
          sideOffset={8}
        >
          <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-gradient-to-b from-surface-1 to-surface-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70 leading-none">
              {t('changelog.title')}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground tracking-tight">
              {t('changelog.subtitle')}
            </p>
          </div>

          <ScrollArea className="max-h-[420px]">
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
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Detalhe completo da versão */}
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
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
