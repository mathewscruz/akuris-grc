/**
 * Lista de evidências esperadas: marcar à mão (com prova e nota) e
 * "Verificar com o Akuris", que lê os documentos ligados e sugere o estado de cada item.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconSuccess, IconAttach, IconIdea } from '@/components/icons';
import { itemAtendido, type IaStatus } from '@/lib/gap-analysis/evidencia-itens';

export interface ItemAvaliado {
  titulo: string;
  descricao: string;
  ligados: { id: string; arquivo: string; url: string | null }[];
}

interface Marcacao {
  item_index: number;
  marcado: boolean;
  nota: string | null;
  prova_nome: string | null;
  ia_status: IaStatus;
  ia_trecho: string | null;
  ia_motivo: string | null;
  ia_fonte: string | null;
}

export function useMarcacoesEvidencia(requirementId: string | null, empresaId: string) {
  return useQuery({
    queryKey: ['gap-evidencia-itens', requirementId, empresaId],
    enabled: !!requirementId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gap_evidencia_itens' as any)
        .select('item_index, marcado, nota, prova_nome, ia_status, ia_trecho, ia_motivo, ia_fonte')
        .eq('requirement_id', requirementId!)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      return (data ?? []) as unknown as Marcacao[];
    },
  });
}

const IA_TOM: Record<string, string> = {
  atendido: 'bg-success/15 text-success',
  parcial: 'bg-warning/15 text-warning',
  nao_encontrado: 'bg-destructive/10 text-destructive',
};
const IA_KEY: Record<string, string> = { atendido: 'iaAtendido', parcial: 'iaParcial', nao_encontrado: 'iaNaoEncontrado' };

export function EvidenciasEsperadasLista({
  requirementId, empresaId, userId, itens, provas,
}: {
  requirementId: string;
  empresaId: string;
  userId?: string;
  itens: ItemAvaliado[];
  provas: string[];
}) {
  const { t, locale } = useLanguage();
  const qc = useQueryClient();
  const key = ['gap-evidencia-itens', requirementId, empresaId];
  const { data: marcacoes = [] } = useMarcacoesEvidencia(requirementId, empresaId);
  const porIndice = new Map(marcacoes.map((m) => [m.item_index, m]));

  const salvar = useMutation({
    mutationFn: async (p: { index: number; marcado: boolean; nota?: string | null; prova?: string | null }) => {
      const { error } = await supabase.from('gap_evidencia_itens' as any).upsert({
        empresa_id: empresaId,
        requirement_id: requirementId,
        item_index: p.index,
        item_texto: itens[p.index]?.titulo ?? '',
        marcado: p.marcado,
        nota: p.nota ?? null,
        prova_nome: p.prova ?? null,
        marcado_por: userId ?? null,
      } as any, { onConflict: 'empresa_id,requirement_id,item_index' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error(t('common.error') || 'Erro'),
  });

  const verificar = useMutation({
    mutationFn: async () => invokeEdgeFunction('verify-evidence-items', {
      body: {
        requirementId,
        itens: itens.map((i) => (i.descricao ? `${i.titulo}: ${i.descricao}` : i.titulo)),
        idioma: String(locale).startsWith('en') ? 'en' : 'pt',
      },
      isAiCall: true,
    }),
    onSuccess: (res: any) => {
      if (res?.error || res?.data?.error) { if (res?.data?.error) toast.error(res.data.error); return; }
      toast.success(t('gapUi.drawer.verifyDone'));
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground flex-1">{t('gapUi.drawer.verifyHint')}</p>
        <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={verificar.isPending} onClick={() => verificar.mutate()}>
          {verificar.isPending ? <AkurisPulse size={14} /> : <IconIdea className="h-4 w-4 mr-1.5" strokeWidth={1.5} />}
          {verificar.isPending ? t('gapUi.drawer.verifying') : t('gapUi.drawer.verifyAkuris')}
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {itens.map((i, n) => {
          const m = porIndice.get(n);
          const ok = itemAtendido(m, i.ligados.length > 0);
          const ia = m?.ia_status;
          return (
            <li key={n} className="flex items-start gap-3 py-3.5">
              <MarcarPopover
                ok={ok}
                marcado={!!m?.marcado}
                provas={provas}
                notaInicial={m?.nota ?? ''}
                provaInicial={m?.prova_nome ?? ''}
                onSalvar={(nota, prova) => salvar.mutate({ index: n, marcado: true, nota, prova })}
                onDesmarcar={() => salvar.mutate({ index: n, marcado: false })}
                t={t}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{i.titulo}</p>
                {i.descricao && <p className="text-xs text-muted-foreground mt-0.5">{i.descricao}</p>}
                {(i.ligados.length > 0 || m?.prova_nome) && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {i.ligados.map((l) => (
                      <a key={l.id} href={l.url || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <IconAttach className="h-3.5 w-3.5" strokeWidth={1.5} />{l.arquivo}
                      </a>
                    ))}
                    {m?.marcado && m.prova_nome && (
                      <span className="inline-flex items-center gap-1 text-xs text-foreground/80"><IconAttach className="h-3.5 w-3.5" strokeWidth={1.5} />{m.prova_nome}</span>
                    )}
                  </div>
                )}
                {m?.marcado && m.nota && <p className="mt-1 text-xs text-muted-foreground italic">{m.nota}</p>}
                {ia && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('rounded-full px-2 py-0.5 font-medium', IA_TOM[ia])}>Akuris · {t(`gapUi.drawer.${IA_KEY[ia]}`)}</span>
                      {m?.ia_fonte && <span className="text-muted-foreground truncate">{m.ia_fonte}</span>}
                      {ia === 'atendido' && !m?.marcado && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-xs text-primary"
                          onClick={() => salvar.mutate({ index: n, marcado: true, prova: m?.ia_fonte ?? null, nota: m?.ia_trecho ? `“${m.ia_trecho}”` : null })}>
                          {t('gapUi.drawer.accept')}
                        </Button>
                      )}
                    </div>
                    {m?.ia_trecho && <p className="mt-1.5 border-l-2 border-border pl-2 text-foreground/80">“{m.ia_trecho}”</p>}
                    {m?.ia_motivo && <p className="mt-1 text-muted-foreground">{m.ia_motivo}</p>}
                  </div>
                )}
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                {ok ? t('gapUi.drawer.found') : t('gapUi.drawer.missing')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MarcarPopover({ ok, marcado, provas, notaInicial, provaInicial, onSalvar, onDesmarcar, t }: {
  ok: boolean; marcado: boolean; provas: string[]; notaInicial: string; provaInicial: string;
  onSalvar: (nota: string | null, prova: string | null) => void; onDesmarcar: () => void;
  t: (k: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState(notaInicial);
  const [prova, setProva] = useState(provaInicial);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setNota(notaInicial); setProva(provaInicial); } }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={marcado ? t('gapUi.drawer.unmark') : t('gapUi.drawer.markDone')}
          className="shrink-0 mt-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {ok
            ? <IconSuccess className="h-5 w-5 text-success" strokeWidth={1.5} />
            : <span className="block h-5 w-5 rounded-full border-[1.5px] border-muted-foreground/60 hover:border-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-sm font-semibold">{t('gapUi.drawer.markDone')}</p>
        <div>
          <label className="text-xs text-muted-foreground">{t('gapUi.drawer.proofLabel')}</label>
          <select value={prova} onChange={(e) => setProva(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{t('gapUi.drawer.noProof')}</option>
            {provas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={500} placeholder={t('gapUi.drawer.notePlaceholder')} className="text-sm" />
        <div className="flex justify-between gap-2">
          {marcado
            ? <Button size="sm" variant="ghost" onClick={() => { onDesmarcar(); setOpen(false); }}>{t('gapUi.drawer.unmark')}</Button>
            : <span />}
          <Button size="sm" onClick={() => { onSalvar(nota.trim() || null, prova || null); setOpen(false); }}>{t('gapUi.drawer.save')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
