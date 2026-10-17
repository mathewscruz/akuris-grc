/**
 * Requisitos agrupados por categoria em acordeões (modelo aprovado):
 * cabeçalho com número, nome, barra de progresso e contagem; tabela com
 * ID, Requisito, Status, Responsável e Evidências. Dados tenant-scoped.
 */
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { OwnerCell } from '@/components/ui/owner-cell';
import { resolveConformityTone } from '@/lib/status-tone';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconChevronDown, IconFileText, IconArrowRight } from '@/components/icons';

interface Props {
  frameworkId: string;
  empresaId: string;
  refreshKey?: number;
  categoriaAtiva?: string;
  onAbrir: (requirementId: string, sequencia: string[]) => void;
}

interface Linha {
  id: string; codigo: string | null; titulo: string; descricao: string | null; categoria: string;
  status: string | null; responsavel: { nome: string; foto: string | null } | null; evidencias: number;
}

const limpar = (s: string | null) => (s ?? '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

export function RequisitosPorCategoria({ frameworkId, empresaId, refreshKey, categoriaAtiva, onAbrir }: Props) {
  const { t, locale } = useLanguage();
  const en = String(locale).startsWith('en');
  const q = useQuery({
    queryKey: ['gap-reqs-por-categoria', frameworkId, empresaId, refreshKey, en],
    enabled: !!frameworkId && !!empresaId,
    queryFn: async (): Promise<Linha[]> => {
      const [reqs, evals, links] = await Promise.all([
        supabase.from('gap_analysis_requirements')
          .select('id,codigo,titulo,titulo_en,descricao,descricao_en,categoria,categoria_en,ordem')
          .eq('framework_id', frameworkId).order('ordem', { ascending: true }).limit(2000),
        supabase.from('gap_analysis_evaluations')
          .select('requirement_id,conformity_status,responsavel_avaliacao')
          .eq('empresa_id', empresaId).eq('framework_id', frameworkId).limit(2000),
        supabase.from('evidence_library_links')
          .select('requirement_id').eq('empresa_id', empresaId).limit(5000),
      ]);
      if (reqs.error) throw reqs.error;
      const ev = new Map((evals.data ?? []).map((e: any) => [e.requirement_id, e]));
      const ids = Array.from(new Set((evals.data ?? []).map((e: any) => e.responsavel_avaliacao).filter(Boolean)));
      const pessoas = new Map<string, { nome: string; foto: string | null }>();
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('user_id,nome,foto_url').eq('empresa_id', empresaId).in('user_id', ids);
        (data ?? []).forEach((p: any) => pessoas.set(p.user_id, { nome: p.nome, foto: p.foto_url }));
      }
      const cont = new Map<string, number>();
      (links.data ?? []).forEach((l: any) => l.requirement_id && cont.set(l.requirement_id, (cont.get(l.requirement_id) ?? 0) + 1));
      return (reqs.data ?? []).map((r: any) => {
        const e: any = ev.get(r.id);
        return {
          id: r.id, codigo: r.codigo,
          titulo: (en && r.titulo_en) || r.titulo,
          descricao: (en && r.descricao_en) || r.descricao,
          categoria: (en && r.categoria_en) || r.categoria || t('gapUi.sidebar.all'),
          status: e?.conformity_status ?? null,
          responsavel: e?.responsavel_avaliacao ? pessoas.get(e.responsavel_avaliacao) ?? null : null,
          evidencias: cont.get(r.id) ?? 0,
        };
      });
    },
  });

  const grupos = useMemo(() => {
    const m = new Map<string, Linha[]>();
    (q.data ?? []).forEach((l) => { if (!m.has(l.categoria)) m.set(l.categoria, []); m.get(l.categoria)!.push(l); });
    return Array.from(m.entries()).map(([nome, itens]) => {
      const aplic = itens.filter((i) => i.status !== 'nao_aplicavel');
      const feitos = aplic.filter((i) => i.status === 'conforme').length;
      return { nome, itens, feitos, total: aplic.length };
    });
  }, [q.data]);

  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!grupos.length) return;
    const alvo = categoriaAtiva ? grupos.find((g) => g.nome === categoriaAtiva || g.itens.some((i) => i.categoria === categoriaAtiva)) : grupos[0];
    if (alvo) {
      setAbertos(new Set([alvo.nome]));
      if (categoriaAtiva) requestAnimationFrame(() => document.getElementById(`cat-${grupos.indexOf(alvo)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [categoriaAtiva, grupos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sequencia = useMemo(() => grupos.flatMap((g) => g.itens.map((i) => i.id)), [grupos]);
  const rotuloStatus = (s: string | null) => t(`gapUi.drawer.status.${s ?? 'nao_avaliado'}`);

  if (q.isLoading) return <div className="flex justify-center py-16"><AkurisPulse size={40} /></div>;

  return (
    <div className="space-y-3">
      {grupos.map((g, n) => {
        const aberto = abertos.has(g.nome);
        const pct = g.total ? Math.round((g.feitos / g.total) * 100) : 0;
        return (
          <section key={g.nome} id={`cat-${n}`} className="scroll-mt-4 rounded-lg border border-border bg-card overflow-hidden" data-keep-frame>
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => setAbertos((s) => { const x = new Set(s); x.has(g.nome) ? x.delete(g.nome) : x.add(g.nome); return x; })}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/40 transition-colors"
            >
              <IconChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !aberto && '-rotate-90')} />
              <span className="text-lg font-semibold text-foreground flex-1 min-w-0 truncate">
                <span className="tabular-nums mr-3">{n + 1}.</span>{g.nome}
              </span>
              <span className="hidden sm:block w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-sm tabular-nums text-muted-foreground w-12 text-right">{g.feitos}/{g.total}</span>
            </button>
            {aberto && (
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground bg-muted/30">
                      <th className="px-5 py-2.5 font-medium w-32">ID</th>
                      <th className="px-3 py-2.5 font-medium">{t('gapUi.cat.requisito')}</th>
                      <th className="px-3 py-2.5 font-medium w-44">{t('gapUi.cat.status')}</th>
                      <th className="px-3 py-2.5 font-medium w-52">{t('gapUi.cat.responsavel')}</th>
                      <th className="px-3 py-2.5 font-medium w-28">{t('gapUi.cat.evidencias')}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.itens.map((i) => (
                      <tr key={i.id} onClick={() => onAbrir(i.id, sequencia)} className="cursor-pointer hover:bg-accent/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground tabular-nums">{i.codigo ?? '—'}</td>
                        <td className="px-3 py-3.5">
                          <p className="font-semibold text-foreground">{i.titulo}</p>
                          {i.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{limpar(i.descricao)}</p>}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusBadge tone={resolveConformityTone(i.status ?? 'nao_avaliado').tone}>{rotuloStatus(i.status)}</StatusBadge>
                        </td>
                        <td className="px-3 py-3.5"><OwnerCell name={i.responsavel?.nome} photo={i.responsavel?.foto} emptyLabel={t('gapUi.cat.semResponsavel')} /></td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-foreground/80 tabular-nums"><IconFileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />{i.evidencias}</span>
                        </td>
                        <td className="pr-4"><IconArrowRight className="h-4 w-4 text-muted-foreground" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
