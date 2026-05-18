import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useEvidenceLibrary, type EvidenceLibraryItem, type CrossMatchSuggestion } from '@/hooks/useEvidenceLibrary';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { Sparkles, Search, FileText, ExternalLink, Library, ChevronRight, CheckCircle2 } from 'lucide-react';
import { akurisToast } from '@/lib/akuris-toast';
import { toast } from 'sonner';

export function EvidenceLibraryHub() {
  const { empresaId } = useEmpresaId();
  const lib = useEvidenceLibrary(empresaId);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<EvidenceLibraryItem | null>(null);
  const [matchResult, setMatchResult] = useState<{ suggestions: CrossMatchSuggestion[]; persisted: number } | null>(null);

  const filtered = lib.items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [it.nome, it.descricao, (it.tags || []).join(' '), it.arquivo_nome]
      .filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
  });

  const runMatch = async (ev: EvidenceLibraryItem) => {
    setRunning(ev.id);
    setOpenItem(ev);
    setMatchResult(null);
    try {
      const result = await lib.runCrossMatch(ev.id);
      if (result) {
        setMatchResult(result);
        if (result.persisted > 0) {
          akurisToast({
            module: 'gap',
            tone: 'success',
            title: 'Cruzamentos identificados',
            description: `${result.persisted} requisito(s) podem usar esta evidência.`,
          });
        } else {
          akurisToast({
            module: 'gap',
            tone: 'info',
            title: 'Nenhum cruzamento encontrado',
            description: 'Nenhum outro requisito compatível foi identificado.',
          });
        }
      }
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" strokeWidth={1.5} />
              <div>
                <h3 className="text-sm font-semibold">Biblioteca de Evidências</h3>
                <p className="text-xs text-muted-foreground">
                  Documentos e links da empresa que podem ser reaproveitados em vários requisitos e frameworks.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{lib.stats.total}</strong> evidências</span>
              <span><strong className="text-foreground">{lib.stats.com_links}</strong> em uso</span>
              {lib.stats.com_sugestoes > 0 && (
                <span className="text-warning"><strong>{lib.stats.com_sugestoes}</strong> com cruzamentos pendentes</span>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evidência por nome, descrição ou tag..."
              className="pl-9"
            />
          </div>

          {lib.loading ? (
            <div className="py-10 flex justify-center"><AkurisPulse /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={lib.items.length === 0 ? 'Sem evidências ainda' : 'Nenhum resultado'}
              description={
                lib.items.length === 0
                  ? 'Faça upload de evidências dentro de qualquer requisito do Gap Analysis. Elas aparecerão aqui automaticamente para reuso.'
                  : 'Tente outro termo de busca.'
              }
            />
          ) : (
            <ScrollArea className="max-h-[480px]">
              <div className="space-y-2 pr-2">
                {filtered.map((ev) => (
                  <div
                    key={ev.id}
                    className="group rounded-lg border border-border/60 bg-background p-3 flex items-center gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                      {ev.link_externo ? (
                        <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ev.nome}</span>
                        {(ev.total_links || 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{ev.total_links} usos</Badge>
                        )}
                        {(ev.total_sugestoes || 0) > 0 && (
                          <StatusBadge tone="warning" size="sm">{ev.total_sugestoes} cruzamentos pendentes</StatusBadge>
                        )}
                        {(ev.tags || []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                      {ev.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ev.descricao}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      onClick={() => runMatch(ev)}
                      disabled={running === ev.id}
                    >
                      {running === ev.id ? (
                        <AkurisPulse size={16} />
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> Cruzar com IA
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openItem} onOpenChange={(o) => { if (!o) { setOpenItem(null); setMatchResult(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
              Cruzamentos para "{openItem?.nome}"
            </DialogTitle>
          </DialogHeader>

          {running === openItem?.id ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <AkurisPulse />
              <p className="text-xs text-muted-foreground">A IA está comparando esta evidência com os requisitos da empresa...</p>
            </div>
          ) : !matchResult ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aguardando análise.</p>
          ) : matchResult.suggestions.length === 0 ? (
            <EmptyState
              title="Nenhum cruzamento"
              description="A IA não identificou outros requisitos onde esta evidência se aplique de forma clara."
            />
          ) : (
            <ScrollArea className="max-h-[480px]">
              <div className="space-y-2 pr-2">
                {matchResult.suggestions.map((s) => (
                  <div key={`${s.requirement_id}`} className="rounded-md border border-border/60 bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.framework_nome && (
                            <Badge variant="outline" className="text-[10px]">{s.framework_nome}</Badge>
                          )}
                          {s.codigo && <span className="text-xs font-mono text-muted-foreground">{s.codigo}</span>}
                        </div>
                        <p className="text-sm font-medium mt-0.5">{s.titulo}</p>
                        {s.justificativa && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.justificativa}</p>
                        )}
                      </div>
                      <StatusBadge
                        tone={s.score >= 0.8 ? 'success' : s.score >= 0.6 ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {Math.round(s.score * 100)}%
                      </StatusBadge>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground pt-2 px-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                  Cruzamentos salvos como pendentes em cada requisito. Acesse o requisito para aceitar e marcar como Conforme.
                </p>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
