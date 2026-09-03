/**
 * O percurso do dado, desenhado.
 *
 * Sete etapas ligadas por um fio, da origem ao descarte. Uma etapa sem texto
 * fica apagada, e isso é informação — mostra o buraco no percurso em vez de o
 * esconder.
 *
 * As etapas abrem em acumulação, não em exclusão: como o dossiê deixou de
 * repetir estes sete campos mais abaixo, o percurso passou a ser o único sítio
 * onde eles se leem. Com uma etapa de cada vez, ler o percurso inteiro obrigava
 * a sete cliques e a perder o que se tinha acabado de ler. `Ver todas` resolve
 * o caso de quem quer ler de fio a pavio.
 *
 * O movimento acompanha a leitura, não a decora: o ponto marca-se ao abrir, o
 * painel entra por baixo, e `Ver todas` abre os sete em cascata pela ordem do
 * percurso — o olho segue o caminho em vez de levar sete blocos de uma vez.
 * Tudo isto cai para nada em `prefers-reduced-motion`.
 */
import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { textoDaVariante } from '@/lib/pt-variants';
import { PERCURSO_DO_DADO } from '@/lib/ropa-percurso';
import { cn } from '@/lib/utils';

interface Props {
  registo: Record<string, unknown>;
  /** Realça nomes de terceiros que não estão no cadastro de fornecedores. */
  realcar?: (texto: string) => React.ReactNode;
}

export function RopaPercurso({ registo, realcar }: Props) {
  const { t, locale } = useLanguage();
  const rotulo = (par: { pt: string; en: string }) => textoDaVariante(String(locale), par);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set());

  const valor = (campo: string) => {
    const v = registo[campo];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  const alternar = (campo: string) =>
    setAbertas((s) => {
      const novo = new Set(s);
      if (novo.has(campo)) novo.delete(campo);
      else novo.add(campo);
      return novo;
    });

  const todasAbertas = abertas.size === PERCURSO_DO_DADO.length;
  const verTudo = () =>
    setAbertas(todasAbertas ? new Set() : new Set(PERCURSO_DO_DADO.map((e) => e.campo)));

  /** Mantém a ordem do percurso, não a ordem em que se clicou. */
  const emLeitura = useMemo(
    () => PERCURSO_DO_DADO.filter((e) => abertas.has(e.campo)),
    [abertas],
  );

  return (
    /* Superfície branca como o resto do dossiê, separada por fio. O cinzento
       lia-se como um bloco estranho encaixado a meio do documento. */
    <div className="border-b border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            {t('ropaDossie.percursoTitulo')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('ropaDossie.percursoNota')}</p>
        </div>
        <button
          type="button"
          onClick={verTudo}
          className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 transition-ui hover:text-primary hover:underline"
        >
          {t(todasAbertas ? 'ropaDossie.recolherEtapas' : 'ropaDossie.verTodasEtapas')}
        </button>
      </div>

      {/* `items-start` é o que mantém o fio direito. Um <button> esticado centra
          o seu conteúdo na vertical (comportamento do próprio elemento, não do
          CSS que lhe pusermos): com sete botões de alturas diferentes, cada
          ponto caía a uma altura e o traço chegava acima do ponto seguinte.
          Sem esticar, não há nada para centrar. */}
      <div className="mt-4 flex items-start overflow-x-auto">
        {PERCURSO_DO_DADO.map((etapa, i) => {
          const texto = valor(etapa.campo);
          const activa = abertas.has(etapa.campo);
          const ultima = i === PERCURSO_DO_DADO.length - 1;
          return (
            <button
              key={etapa.campo}
              type="button"
              onClick={() => alternar(etapa.campo)}
              aria-pressed={activa}
              title={texto ?? undefined}
              className="group flex min-w-[136px] flex-1 shrink-0 flex-col text-left"
            >
              {/* O fio corre até ao ponto seguinte: o botão não tem folga à
                  direita, a folga está no texto. Com folga no botão, o traço
                  parava 10px antes do ponto e o percurso lia-se partido. */}
              <span className="mb-2 flex items-center">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full border-2 duration-200 ease-out',
                    'transition-[transform,background-color,box-shadow,border-color]',
                    'motion-reduce:transition-none',
                    texto ? 'border-primary' : 'border-muted-foreground/60',
                    activa
                      ? 'scale-125 bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.14)]'
                      : 'bg-card group-hover:scale-110 group-hover:bg-primary/25',
                  )}
                />
                {!ultima && (
                  <span
                    className={cn(
                      'h-0.5 flex-1 transition-colors duration-200 motion-reduce:transition-none',
                      texto ? 'bg-primary/35' : 'bg-border',
                    )}
                  />
                )}
              </span>
              <span className="block pr-3">
                {/* O rótulo aberto NÃO fica roxo: com `Ver todas` as sete
                    etiquetas ficavam roxas ao mesmo tempo e o realce deixava de
                    realçar. Quem diz o que está aberto é o ponto cheio; o roxo
                    fica para o hover, como no resto do produto. */}
                <span
                  className={cn(
                    'block text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none',
                    texto ? 'text-foreground' : 'text-muted-foreground',
                    'group-hover:text-primary',
                  )}
                >
                  {rotulo(etapa.rotulo)}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-micro leading-snug text-muted-foreground">
                  {texto ?? t('ropaDossie.porPreencher')}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {emLeitura.length > 0 && (
        <div className="mt-4 grid gap-2">
          {emLeitura.map((etapa, i) => {
            const texto = valor(etapa.campo);
            return (
              <div
                key={etapa.campo}
                /* A cascata só faz sentido quando se abre o percurso inteiro:
                   com uma etapa só, o atraso lia-se como lentidão. */
                style={todasAbertas ? { animationDelay: `${i * 45}ms` } : undefined}
                /* Painel branco sobre fundo branco precisa de outra marca: o
                   trilho roxo à esquerda diz qual é a etapa que está aberta. */
                className={cn(
                  'animate-fade-in rounded-lg border border-border border-l-2 border-l-primary',
                  'bg-card px-4 py-3 motion-reduce:animate-none',
                )}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {rotulo(etapa.rotulo)}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    {rotulo(etapa.nota)}
                  </span>
                </p>
                <div className="max-w-[86ch] whitespace-pre-wrap text-sm leading-relaxed">
                  {texto ? (
                    realcar ? (
                      realcar(texto)
                    ) : (
                      texto
                    )
                  ) : (
                    <span className="text-muted-foreground">{t('ropaDossie.etapaSemTexto')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
