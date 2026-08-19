/**
 * O ROPA como documento, e não como linha de tabela.
 *
 * A aba mostrava 3 dos 26 campos — nome, base legal e categoria de titulares —
 * e clicar numa linha não abria nada. Quem precisava de ler o registo inteiro
 * ia à planilha, que é o oposto do que o produto devia fazer.
 *
 * Este é o dossiê: a identidade e os sinais no topo, o percurso do dado, as
 * bases legais separadas com o seu âmbito, e o resto das secções da planilha
 * como capítulos — cada campo com a sua descrição visível ao lado do rótulo.
 * Essa descrição já existia em `ropa-schema.ts`, mas só aparecia como
 * placeholder, ou seja: desaparecia no instante em que alguém preenchia o
 * campo.
 *
 * Cada campo aparece UMA vez. A primeira versão desenhava a capa, o percurso e
 * as bases legais e depois repetia os mesmos 13 campos nos capítulos: o mesmo
 * parágrafo de "Fonte dos dados" lia-se em Origem e outra vez em Dados, o
 * mesmo "Alto" em Risco na capa e em Risco no capítulo. Um documento que se diz
 * a si próprio duas vezes lê-se como rascunho. Quem manda é a secção de cima —
 * ver `camposJaMostrados`.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconChevron, IconEdit } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useJurisdicao } from '@/hooks/useJurisdicao';
import { useRopaBasesLegais } from '@/hooks/useRopaBasesLegais';
import { supabase } from '@/integrations/supabase/client';
import { camposJaMostrados as planoDoDossie } from '@/lib/ropa-dossie-plano';
import { ROPA_SECTIONS, ropaFieldsBySection, type RopaFieldDef } from '@/lib/ropa-schema';
import { resolveSeveridadeTone, resolveItemStatusTone } from '@/lib/status-tone';
import { textoDaVariante } from '@/lib/pt-variants';
import { formatStatus } from '@/lib/text-utils';
import { cn } from '@/lib/utils';
import { RopaPercurso } from '@/components/dados/RopaPercurso';

interface Props {
  registo: Record<string, any>;
  onEditar?: () => void;
}

/** Campos guardados como `profiles.user_id` — sem tradução, sairia um UUID. */
const DE_UTILIZADOR = new Set(['responsavel_tratamento', 'encarregado_dados']);

export function RopaDossie({ registo, onEditar }: Props) {
  const { t, locale } = useLanguage();
  /** Rótulo do esquema já na variante activa — ver `textoDaVariante`. */
  const rotuloDoEsquema = (par: { pt: string; en: string }) => textoDaVariante(String(locale), par);
  const jurisdicao = useJurisdicao();
  const { data: bases = [] } = useRopaBasesLegais(registo?.id);

  /**
   * A sensibilidade do tratamento decide de que artigo a base tem de vir —
   * Art. 7 ou Art. 11 na LGPD, Art. 6 ou Art. 9 no RGPD. Vem calculada na
   * consulta da página, a partir do dado mais sensível que o registo toca.
   */
  const sensibilidade = (registo?.sensibilidade_maxima as string | undefined) ?? null;

  const idsDePessoa = useMemo(
    () => [...DE_UTILIZADOR].map((k) => registo?.[k]).filter(Boolean) as string[],
    [registo],
  );

  const { data: nomeDePessoa = {} } = useQuery({
    queryKey: ['ropa-dossie-pessoas', idsDePessoa],
    enabled: idsDePessoa.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .in('user_id', idsDePessoa);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p: any) => [p.user_id, p.nome]));
    },
  });

  // Finalidade e Dados abertos por omissão: é o que se lê primeiro num ROPA.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(['finalidade', 'dados']),
  );

  const alternar = (chave: string) =>
    setAbertos((s) => {
      const novo = new Set(s);
      novo.has(chave) ? novo.delete(chave) : novo.add(chave);
      return novo;
    });

  const preenchido = (campo: string) => {
    const v = registo?.[campo];
    return typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;
  };

  /** A repartição vive em `ropa-dossie-plano`, onde um teste a verifica. */
  const camposJaMostrados = useMemo(() => planoDoDossie(bases.length > 0), [bases.length]);

  const seccoes = useMemo(
    () =>
      ROPA_SECTIONS.map((seccao) => {
        const campos = ropaFieldsBySection(seccao.key).filter(
          (f) => !camposJaMostrados.has(f.key),
        );
        return { seccao, campos, comValor: campos.filter((f) => preenchido(f.key)).length };
      }).filter((s) => s.campos.length > 0),
    [registo, camposJaMostrados],
  );

  if (!registo) return null;

  const nivel = registo.risco_nivel as string | undefined;

  /** Rótulo do valor de um campo, já traduzido do que está gravado. */
  const valorDoCampo = (campo: RopaFieldDef): string | null => {
    const v = registo[campo.key];
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return null;
    if (DE_UTILIZADOR.has(campo.key)) {
      return nomeDePessoa[String(v)] ?? t('ropaDossie.pessoaDesconhecida');
    }
    if (typeof v === 'boolean') return t(v ? 'common.yes' : 'common.no');
    if (campo.type === 'select') return formatStatus(String(v));
    return String(v);
  };

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      {/* ── capa ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              {registo.area_responsavel || t('ropaDossie.semArea')}
              {registo.codigo ? ` · ${registo.codigo}` : ''}
            </p>
            <h2 className="mt-1.5 max-w-[46ch] text-2xl font-semibold leading-tight text-balance">
              {registo.nome_tratamento}
            </h2>
          </div>
          {onEditar && (
            <Button variant="outline" size="sm" onClick={onEditar} className="shrink-0">
              <IconEdit className="h-4 w-4" /> {t('common.edit')}
            </Button>
          )}
        </div>

        {/* Pílulas só para o que é alarme: o nível de risco e as duas bandeiras
            que a LGPD manda declarar. As leituras vão para a linha de baixo. */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {nivel ? (
            <StatusBadge {...resolveSeveridadeTone(nivel)}>
              {t('ropaDossie.risco', { nivel: formatStatus(nivel) })}
            </StatusBadge>
          ) : (
            <StatusBadge {...resolveItemStatusTone(null)}>
              {t('ropaDossie.riscoPorClassificar')}
            </StatusBadge>
          )}
          {registo.transferencia_internacional && (
            <StatusBadge tone="warning">{t('ropaDossie.transferenciaInternacional')}</StatusBadge>
          )}
          {registo.decisao_automatizada && (
            <StatusBadge tone="warning">{t('ropaDossie.decisaoAutomatizada')}</StatusBadge>
          )}
        </div>

      </header>

      <RopaPercurso registo={registo} />

      {/* ── bases legais ─────────────────────────────────────────────────── */}
      {bases.length > 0 && (
        <section className="border-b border-border px-6 py-5">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            {t('ropaDossie.basesTitulo')}
          </p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            {bases.length > 1
              ? t('ropaDossie.basesVarias', { total: bases.length })
              : t('ropaDossie.baseUnica')}
          </p>
          <div className="grid gap-2">
            {bases.map((base, i) => {
              const lida = jurisdicao.baseLegal(base.base_legal, sensibilidade);
              return (
                <div
                  key={base.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 rounded-md border border-border px-3 py-2.5"
                >
                  <span className="mt-px rounded bg-accent px-1.5 py-0.5 text-micro font-bold tabular-nums text-accent-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    {/* `jurisdicao.baseLegal` é o caminho canónico: devolve o
                        rótulo E o veredicto de licitude, e trata o valor que a
                        lei não conhece em vez de o apresentar como correto. */}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="max-w-[86ch] text-sm font-semibold">{lida.label}</span>
                      {lida.estado !== 'ok' && (
                        <StatusBadge tone="warning">
                          {t('ropaDossie.basePorClassificar')}
                        </StatusBadge>
                      )}
                    </span>
                    {base.abrangencia && (
                      <span className="mt-0.5 block max-w-[86ch] text-xs text-muted-foreground">
                        {base.abrangencia}
                      </span>
                    )}
                    {base.justificativa && base.justificativa !== lida.label && (
                      <span className="mt-1 block max-w-[86ch] text-xs leading-relaxed text-muted-foreground">
                        {base.justificativa}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── capítulos ────────────────────────────────────────────────────── */}
      {seccoes.map(({ seccao, campos, comValor }) => {
        const aberto = abertos.has(seccao.key);
        return (
          <section key={seccao.key} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => alternar(seccao.key)}
              aria-expanded={aberto}
              className="flex w-full items-center gap-2.5 px-6 py-3.5 text-left transition-ui hover:bg-accent"
            >
              <span className="text-sm font-semibold">{rotuloDoEsquema(seccao.label)}</span>
              <span className="text-micro tabular-nums text-muted-foreground">
                {comValor}/{campos.length}
              </span>
              <IconChevron
                className={cn(
                  'ml-auto h-4 w-4 text-muted-foreground transition-ui',
                  aberto && 'rotate-90',
                )}
                strokeWidth={1.5}
              />
            </button>

            {aberto && (
              <div className="grid gap-4 px-6 pb-5">
                {campos.map((campo) => {
                  const valor = valorDoCampo(campo);
                  return (
                    <div key={campo.key}>
                      <p className="text-xs font-semibold tracking-wide">{rotuloDoEsquema(campo.label)}</p>
                      <p className="text-micro text-muted-foreground">{rotuloDoEsquema(campo.hint)}</p>
                      <p
                        className={cn(
                          'mt-1.5 max-w-[86ch] whitespace-pre-wrap text-sm leading-relaxed',
                          !valor && 'text-muted-foreground',
                        )}
                      >
                        {valor ?? t('ropaDossie.porPreencher')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
