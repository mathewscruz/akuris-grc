import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconChip } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import {
  AI_MODELS, USD_BRL, custoRealUSD, featuresUsingModel, aiFeatureLabel, type AiModelId,
} from '@/lib/ai-usage-catalog';

type Periodo = 'mes' | '30' | '90';

interface Linha {
  modelo: string; reserva: boolean; sucesso: boolean;
  tokens_entrada: number | null; tokens_saida: number | null;
}

export interface ResumoModelo {
  modelo: string; label: string; provider: string;
  chamadas: number; tin: number; tout: number; custoBRL: number;
  erros: number; reserva: number; descontinuado: boolean; fallbackOnly: boolean;
}

/** Agrega as chamadas por modelo. Exportado para teste. */
export function agregarUso(linhas: Linha[]): ResumoModelo[] {
  const mapa = new Map<string, ResumoModelo>();
  for (const [id, m] of Object.entries(AI_MODELS)) {
    if (m.descontinuado) continue;
    mapa.set(id, { modelo: id, label: m.label, provider: m.provider, chamadas: 0, tin: 0, tout: 0, custoBRL: 0, erros: 0, reserva: 0, descontinuado: false, fallbackOnly: !!m.fallbackOnly });
  }
  for (const l of linhas) {
    let r = mapa.get(l.modelo);
    if (!r) {
      const m = AI_MODELS[l.modelo as AiModelId];
      r = { modelo: l.modelo, label: m?.label ?? l.modelo, provider: m?.provider ?? l.modelo.split('/')[0], chamadas: 0, tin: 0, tout: 0, custoBRL: 0, erros: 0, reserva: 0, descontinuado: true, fallbackOnly: false };
      mapa.set(l.modelo, r);
    }
    r.chamadas += 1;
    r.tin += l.tokens_entrada ?? 0;
    r.tout += l.tokens_saida ?? 0;
    if (!l.sucesso) r.erros += 1;
    if (l.reserva) r.reserva += 1;
    r.custoBRL += (custoRealUSD(l.modelo, l.tokens_entrada, l.tokens_saida) ?? 0) * USD_BRL;
  }
  return [...mapa.values()];
}

function inicioDoPeriodo(p: Periodo): string {
  const d = new Date();
  if (p === 'mes') { d.setDate(1); d.setHours(0, 0, 0, 0); } else d.setDate(d.getDate() - Number(p));
  return d.toISOString();
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR');
const fmtBRL = (n: number, casas = 2) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

export function ModelosIAUsoCard() {
  const { t, locale } = useLanguage();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      const todas: Linha[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await supabase
          .from('ia_uso_modelos' as never)
          .select('modelo, reserva, sucesso, tokens_entrada, tokens_saida')
          .gte('created_at', inicioDoPeriodo(periodo))
          .range(de, de + 999);
        if (error) { logger.error('ia_uso_modelos', error); break; }
        todas.push(...((data ?? []) as unknown as Linha[]));
        if (!data || data.length < 1000) break;
      }
      if (vivo) { setLinhas(todas); setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [periodo]);

  const resumo = useMemo(() => agregarUso(linhas), [linhas]);
  const tot = useMemo(() => resumo.reduce((a, r) => ({
    chamadas: a.chamadas + r.chamadas, tin: a.tin + r.tin, tout: a.tout + r.tout,
    custo: a.custo + r.custoBRL, erros: a.erros + r.erros, reserva: a.reserva + r.reserva,
  }), { chamadas: 0, tin: 0, tout: 0, custo: 0, erros: 0, reserva: 0 }), [resumo]);

  const periodos: { v: Periodo; l: string }[] = [
    { v: 'mes', l: t('configPlanos.financeiroIA.uso.periodoMes') },
    { v: '30', l: t('configPlanos.financeiroIA.uso.periodo30') },
    { v: '90', l: t('configPlanos.financeiroIA.uso.periodo90') },
  ];
  const th = 'px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconChip className="h-5 w-5" />
          {t('configPlanos.financeiroIA.modelosTitle')}
        </CardTitle>
        <div role="group" className="inline-flex rounded-md border border-border p-0.5">
          {periodos.map((p) => (
            <Button key={p.v} size="sm" variant={periodo === p.v ? 'secondary' : 'ghost'} className="h-7 px-3 text-xs"
              aria-pressed={periodo === p.v} onClick={() => setPeriodo(p.v)}>{p.l}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><AkurisPulse size={32} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="akuris-table w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${th} text-left`}>{t('configPlanos.financeiroIA.colModelo')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colChamadas')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colTokens')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colCustoReal')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colMedia')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colErros')}</th>
                  <th className={`${th} text-right`}>{t('configPlanos.financeiroIA.uso.colReserva')}</th>
                  <th className={th}><span className="sr-only">{t('configPlanos.financeiroIA.uso.verFuncionalidades')}</span></th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => {
                  const feats = featuresUsingModel(r.modelo as AiModelId);
                  return (
                    <tr key={r.modelo} className="border-b border-border/50 align-middle">
                      <td className="px-3 py-2.5 min-w-[180px]">
                        <div className="font-medium text-foreground whitespace-nowrap">{r.label}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.provider}
                          {r.fallbackOnly && <> · {t('configPlanos.financeiroIA.uso.planoB')}</>}
                          {r.descontinuado && <> · {t('configPlanos.financeiroIA.uso.descontinuado')}</>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmtInt(r.chamadas)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">{fmtInt(r.tin)} / {fmtInt(r.tout)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">{fmtBRL(r.custoBRL)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">{r.chamadas ? fmtBRL(r.custoBRL / r.chamadas, 4) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${r.erros ? 'text-destructive' : 'text-muted-foreground'}`}>{r.chamadas ? `${Math.round((r.erros / r.chamadas) * 100)}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtInt(r.reserva)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs whitespace-nowrap">
                              {t('configPlanos.financeiroIA.uso.verFuncionalidades')} ({feats.length})
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('configPlanos.financeiroIA.uso.funcionalidadesDoModelo')}</p>
                            {feats.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t('configPlanos.financeiroIA.uso.semFuncionalidades')}</p>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {feats.map((f) => <li key={f.key}>{aiFeatureLabel(f.key, locale)}</li>)}
                              </ul>
                            )}
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t border-border">
                  <td className="px-3 pt-3">{t('configPlanos.financeiroIA.uso.total')}</td>
                  <td className="px-3 pt-3 text-right tabular-nums">{fmtInt(tot.chamadas)}</td>
                  <td className="px-3 pt-3 text-right tabular-nums whitespace-nowrap">{fmtInt(tot.tin)} / {fmtInt(tot.tout)}</td>
                  <td className="px-3 pt-3 text-right tabular-nums whitespace-nowrap">{fmtBRL(tot.custo)}</td>
                  <td className="px-3 pt-3 text-right tabular-nums whitespace-nowrap">{tot.chamadas ? fmtBRL(tot.custo / tot.chamadas, 4) : '—'}</td>
                  <td className="px-3 pt-3 text-right tabular-nums">{tot.chamadas ? `${Math.round((tot.erros / tot.chamadas) * 100)}%` : '—'}</td>
                  <td className="px-3 pt-3 text-right tabular-nums">{fmtInt(tot.reserva)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {tot.chamadas === 0 && !loading ? `${t('configPlanos.financeiroIA.uso.vazio')} ` : ''}
          {t('configPlanos.financeiroIA.uso.nota', { cotacao: USD_BRL.toFixed(2) })}
        </p>
      </CardContent>
    </Card>
  );
}
