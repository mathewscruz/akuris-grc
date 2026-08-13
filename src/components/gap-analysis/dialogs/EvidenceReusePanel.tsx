import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { useEvidenceLibrary, type EvidenceLibraryItem } from '@/hooks/useEvidenceLibrary';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Sparkles, Link2, FileText, ExternalLink, Search, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { akurisToast } from '@/lib/akuris-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Requisito atual sendo avaliado */
  requirementId: string;
  frameworkId: string;
  evaluationId: string | null | undefined;
  /** Disparado após vincular, para o pai recarregar */
  onLinked?: () => void;
}

interface SuggestionRow {
  id: string;
  evidence_id: string;
  ia_score: number | null;
  ia_justificativa: string | null;
  evidence: EvidenceLibraryItem | null;
}

function scoreBadge(score: number | null | undefined, t: (key: string) => string) {
  if (score == null) return null;
  if (score >= 0.8) return <StatusBadge tone="success" size="sm">{t('gapAnalysis.evidenceReuse.highAdherence')} · {Math.round(score * 100)}%</StatusBadge>;
  if (score >= 0.6) return <StatusBadge tone="warning" size="sm">{t('gapAnalysis.evidenceReuse.possible')} · {Math.round(score * 100)}%</StatusBadge>;
  return <StatusBadge tone="neutral" size="sm">{Math.round(score * 100)}%</StatusBadge>;
}

export function EvidenceReusePanel({ requirementId, frameworkId, evaluationId, onLinked }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const lib = useEvidenceLibrary(empresaId);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [search, setSearch] = useState('');

  const reload = async () => {
    if (!requirementId) return;
    setLoadingSug(true);
    try {
      const data = await lib.fetchSuggestionsForRequirement(requirementId);
      setSuggestions((data || []) as SuggestionRow[]);
    } finally {
      setLoadingSug(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [requirementId, empresaId]);

  const handleAcceptSuggestion = async (linkId: string) => {
    const ok = await lib.acceptSuggestion(linkId);
    if (ok) {
      akurisToast({ module: 'gap', tone: 'success', title: t('gapAnalysis.evidenceReuse.evidenceLinked'), description: t('gapAnalysis.evidenceReuse.recommendationApplied') });
      await reload();
      onLinked?.();
    }
  };

  const handleDismiss = async (linkId: string) => {
    const ok = await lib.unlink(linkId);
    if (ok) {
      await reload();
    }
  };

  const handleManualLink = async (evidence: EvidenceLibraryItem) => {
    if (!evaluationId) {
      toast.error(t('gapAnalysis.evidenceReuse.saveEvaluationFirst'));
      return;
    }
    const ok = await lib.linkToEvaluation({
      evidence_id: evidence.id,
      evaluation_id: evaluationId,
      requirement_id: requirementId,
      framework_id: frameworkId,
    });
    if (ok) {
      akurisToast({ module: 'gap', tone: 'success', title: t('gapAnalysis.evidenceReuse.evidenceLinked'), description: evidence.nome });
      onLinked?.();
    }
  };

  const filteredLibrary = lib.items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [it.nome, it.descricao, (it.tags || []).join(' '), it.arquivo_nome]
      .filter(Boolean)
      .some((t) => String(t).toLowerCase().includes(q));
  });

  return (
    <Card className="border border-border/60 bg-muted/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <h4 className="text-sm font-semibold">{t('gapAnalysis.evidenceReuse.title')}</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('gapAnalysis.evidenceReuse.description')}
        </p>

        <Tabs defaultValue="sugestoes">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="sugestoes">
              {t('gapAnalysis.evidenceReuse.recommendedTab')}{suggestions.length > 0 ? ` · ${suggestions.length}` : ''}
            </TabsTrigger>
            <TabsTrigger value="biblioteca">
              {t('gapAnalysis.evidenceReuse.libraryTab')} · {lib.items.length}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sugestoes" className="mt-3">
            {loadingSug ? (
              <div className="py-6 flex justify-center"><AkurisPulse size={32} /></div>
            ) : suggestions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground">
                {t('gapAnalysis.evidenceReuse.noSuggestions')}
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="rounded-md border border-border/60 bg-background p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-sm font-medium truncate">{s.evidence?.nome || 'Evidência'}</span>
                          </div>
                          {s.ia_justificativa && (
                            <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{s.ia_justificativa}</p>
                          )}
                        </div>
                        {scoreBadge(s.ia_score, t)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="default" onClick={() => handleAcceptSuggestion(s.id)} className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('gapAnalysis.evidenceReuse.link')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDismiss(s.id)} className="gap-1 text-muted-foreground">
                          <X className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('gapAnalysis.evidenceReuse.ignore')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="biblioteca" className="mt-3 space-y-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('gapAnalysis.evidenceReuse.searchPlaceholder')}
                className="pl-8 h-9"
              />
            </div>
            {lib.loading ? (
              <div className="py-6 flex justify-center"><AkurisPulse size={32} /></div>
            ) : filteredLibrary.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground">
                {lib.items.length === 0
                  ? t('gapAnalysis.evidenceReuse.emptyLibrary')
                  : t('gapAnalysis.evidenceReuse.noResults')}
              </div>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {filteredLibrary.map((ev) => (
                    <div key={ev.id} className="rounded-md border border-border/60 bg-background p-3 flex items-start gap-3">
                      <div className="mt-0.5 h-7 w-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                        {ev.link_externo ? (
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{ev.nome}</span>
                          {(ev.total_links || 0) > 0 && (
                            <Badge variant="secondary" className="text-[10px]">{ev.total_links} {t('gapAnalysis.evidenceReuse.uses')}</Badge>
                          )}
                        </div>
                        {ev.descricao && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{ev.descricao}</p>
                        )}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleManualLink(ev)}>
                              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} /> {t('gapAnalysis.evidenceReuse.link')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('gapAnalysis.evidenceReuse.linkTooltip')}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
