import { useRef, useState } from 'react';
import { IconSearch, IconExternal, IconSuccess, IconFile, IconChevron, IconBook, IconUpload } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogShell } from '@/components/ui/dialog-shell';
;
import { ScrollArea } from '@/components/ui/scroll-area';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  useEvidenceLibrary,
  estadoDaValidade,
  type EvidenceLibraryItem,
  type CrossMatchSuggestion,
} from '@/hooks/useEvidenceLibrary';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { IconCalendarClock } from '@/components/icons';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import { akurisToast } from '@/lib/akuris-toast';
import { toast } from '@/lib/toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { intlLocale } from '@/lib/date-utils';

/**
 * Selo de validade da prova.
 *
 * Uma política revista há catorze meses continuava a pintar o requisito de
 * verde para sempre — a evidência simplesmente não tinha prazo no modelo. É o
 * que separa "conformidade" de "conformidade contínua", e é onde a Vanta e a
 * Drata ganham: numa auditoria de manutenção, o controlo existe mas a prova de
 * que ele continua a operar caducou.
 */
function SeloDeValidade({ validoAte }: { validoAte: string | null }) {
  const { t } = useLanguage();
  const { estado, dias } = estadoDaValidade(validoAte);
  if (estado === 'sem_prazo') {
    return <StatusBadge tone="neutral" variant="outline">{t('sweepRiscos.gap.evidenceHub.semPrazo')}</StatusBadge>;
  }
  if (estado === 'vencida') {
    return (
      <StatusBadge tone="destructive">
        {t('sweepRiscos.gap.evidenceHub.vencidaHa', { dias: Math.abs(dias ?? 0) })}
      </StatusBadge>
    );
  }
  if (estado === 'a_vencer') {
    return (
      <StatusBadge tone="warning">
        {t('sweepRiscos.gap.evidenceHub.venceEm', { dias: dias ?? 0 })}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="success" variant="outline">
      {t('sweepRiscos.gap.evidenceHub.validaAte', {
        data: new Date(validoAte + 'T00:00:00').toLocaleDateString(intlLocale()),
      })}
    </StatusBadge>
  );
}

export function EvidenceLibraryHub() {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const lib = useEvidenceLibrary(empresaId);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputFicheiro = useRef<HTMLInputElement>(null);
  const [openItem, setOpenItem] = useState<EvidenceLibraryItem | null>(null);
  const [matchResult, setMatchResult] = useState<{ suggestions: CrossMatchSuggestion[]; persisted: number } | null>(null);

  const filtered = lib.items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [it.nome, it.descricao, (it.tags || []).join(' '), it.arquivo_nome]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
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
            title: t('sweepRiscos.gap.evidenceHub.cruzamentosIdentificados'),
            description: t('sweepRiscos.gap.evidenceHub.cruzamentosIdentificadosDesc', { count: result.persisted }),
          });
        } else {
          akurisToast({
            module: 'gap',
            tone: 'info',
            title: t('sweepRiscos.gap.evidenceHub.nenhumCruzamentoEncontrado'),
            description: t('sweepRiscos.gap.evidenceHub.nenhumCruzamentoEncontradoDesc'),
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
              <IconBook className="h-5 w-5 text-primary" strokeWidth={1.5} />
              <div>
                <h3 className="text-sm font-semibold">{t('residuos.evidencias.biblioteca')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('sweepRiscos.gap.evidenceHub.bibliotecaDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{lib.stats.total}</strong> {t('cardsKpi.sweep.gap.evidencias')}</span>
              <span><strong className="text-foreground">{lib.stats.com_links}</strong> {t('cardsKpi.sweep.gap.emUso')}</span>
              {lib.stats.com_sugestoes > 0 && (
                <span className="text-warning"><strong>{lib.stats.com_sugestoes}</strong> {t('cardsKpi.sweep.gap.comCruzamentosPendentes')}</span>
              )}
              {lib.stats.vencidas > 0 && (
                <span className="text-destructive"><strong>{lib.stats.vencidas}</strong> {t('sweepRiscos.gap.evidenceHub.kpiVencidas')}</span>
              )}
              {lib.stats.a_vencer > 0 && (
                <span className="text-warning"><strong>{lib.stats.a_vencer}</strong> {t('sweepRiscos.gap.evidenceHub.kpiAVencer')}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('campos.comum.buscarEvidencia')}
                className="pl-9"
              />
            </div>
            {/*
              A biblioteca não tinha por onde acrescentar nada.

              `uploadAndCreate` estava escrito no hook e não era chamado de
              lado nenhum: quem chegava aqui só podia olhar. Agora a prova que
              não nasce de um requisito — o certificado do fornecedor, a
              apólice, a acta do comité — entra por aqui e fica disponível para
              todos os requisitos e frameworks.
            */}
            <input
              ref={inputFicheiro}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setEnviando(true);
                try {
                  await lib.uploadAndCreate({ nome: file.name, file });
                } finally {
                  setEnviando(false);
                }
              }}
            />
            <Button
              variant="outline"
              className="gap-1.5 shrink-0"
              disabled={enviando}
              onClick={() => inputFicheiro.current?.click()}
            >
              <IconUpload className="h-4 w-4" strokeWidth={1.5} />
              {t('sweepRiscos.gap.evidenceHub.adicionar')}
            </Button>
          </div>

          {lib.loading ? (
            <div className="py-10 flex justify-center"><AkurisPulse /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={lib.items.length === 0 ? t('sweepRiscos.gap.evidenceHub.semEvidencias') : t('sweepRiscos.gap.evidenceHub.nenhumResultado')}
              description={
                lib.items.length === 0
                  ? t('sweepRiscos.gap.evidenceHub.semEvidenciasDesc')
                  : t('sweepRiscos.gap.evidenceHub.nenhumResultadoDesc')
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
                    <div className="h-9 w-9 flex items-center justify-center shrink-0">
                      {ev.link_externo ? (
                        <IconExternal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      ) : (
                        <IconFile className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ev.nome}</span>
                        {(ev.total_links || 0) > 0 && (
                          <StatusBadge tone="neutral">{ev.total_links} {t('sweepRiscos.gap.evidenceHub.usos')}</StatusBadge>
                        )}
                        {(ev.total_sugestoes || 0) > 0 && (
                          <StatusBadge tone="warning">{ev.total_sugestoes} {t('sweepRiscos.gap.evidenceHub.cruzamentosPendentes')}</StatusBadge>
                        )}
                        <SeloDeValidade validoAte={ev.valido_ate} />
                        {(ev.tags || []).slice(0, 3).map((t) => (
                          <StatusBadge key={t} tone="neutral" variant="outline">{t}</StatusBadge>
                        ))}
                      </div>
                      {ev.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ev.descricao}</p>
                      )}
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="gap-1 shrink-0" aria-label={t('sweepRiscos.gap.evidenceHub.definirValidade')}>
                          <IconCalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`val-${ev.id}`} className="text-sm">
                            {t('sweepRiscos.gap.evidenceHub.validaAteCampo')}
                          </Label>
                          <Input
                            id={`val-${ev.id}`}
                            type="date"
                            defaultValue={ev.valido_ate ?? ''}
                            onChange={(e) =>
                              lib.definirValidade(ev.id, e.target.value || null, ev.periodicidade_meses)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`per-${ev.id}`} className="text-sm">
                            {t('sweepRiscos.gap.evidenceHub.periodicidade')}
                          </Label>
                          <Input
                            id={`per-${ev.id}`}
                            type="number"
                            min={1}
                            max={120}
                            defaultValue={ev.periodicidade_meses ?? ''}
                            placeholder="12"
                            onChange={(e) =>
                              lib.definirValidade(
                                ev.id,
                                ev.valido_ate,
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('sweepRiscos.gap.evidenceHub.periodicidadeAjuda')}
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                          {t('sweepRiscos.gap.evidenceHub.cruzarComIA')}
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

      <DialogShell
        open={!!openItem}
        onOpenChange={(o) => { if (!o) { setOpenItem(null); setMatchResult(null); } }}
        icon={IconBook}
        title={t('sweepRiscos.gap.evidenceHub.cruzamentosPara', { nome: openItem?.nome ?? '' })}
        size="md"
        hideFooter
      >
          {running === openItem?.id ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <AkurisPulse />
              <p className="text-xs text-muted-foreground">{t('residuos.evidencias.iaComparando')}</p>
            </div>
          ) : !matchResult ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('residuos.evidencias.aguardandoAnalise')}</p>
          ) : matchResult.suggestions.length === 0 ? (
            <EmptyState
              title={t('residuos.evidencias.nenhumCruzamento')}
              description={t('residuos.evidencias.nenhumCruzamentoDesc')}
            />
          ) : (
            <ScrollArea className="max-h-[480px]">
              <div className="space-y-2 pr-2">
                {matchResult.suggestions.map((s) => (
                  <div key={`${s.requirement_id}`} className="rounded-md border border-border/60 bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.framework_nome && (
                            <StatusBadge tone="neutral" variant="outline">{s.framework_nome}</StatusBadge>
                          )}
                          {s.codigo && <span className="text-xs font-mono text-muted-foreground">{s.codigo}</span>}
                        </div>
                        <p className="text-sm font-medium mt-0.5">{s.titulo}</p>
                        {s.justificativa && (
                          <p className="text-micro text-muted-foreground mt-1 line-clamp-2">{s.justificativa}</p>
                        )}
                      </div>
                      <StatusBadge
                        tone={s.score >= 0.8 ? 'success' : s.score >= 0.6 ? 'warning' : 'neutral'}
                      >
                        {Math.round(s.score * 100)}%
                      </StatusBadge>
                    </div>
                  </div>
                ))}
                <p className="text-micro text-muted-foreground pt-2 px-1 flex items-center gap-1">
                  <IconSuccess className="h-3 w-3" strokeWidth={1.5} />
                  {t('sweepRiscos.gap.evidenceHub.cruzamentosSalvos')}
                </p>
              </div>
            </ScrollArea>
          )}
      </DialogShell>
    </div>
  );
}
