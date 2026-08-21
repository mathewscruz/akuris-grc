/**
 * CanalLayout — a casca das três telas públicas do canal.
 *
 * O que estava no ar era o casco da aplicação reaproveitado: fundo azul-escuro
 * da Akuris, cartão branco ao centro, e nada que dissesse a quem chega o que
 * lhe vai acontecer. Três julgamentos por trás desta reescrita:
 *
 *  1. **Fundo claro.** Quem abre este ecrã costuma estar com medo. Um fundo
 *     escuro e frio lê-se como sala de interrogatório; e num produto de marca
 *     branca, o fundo tem de ser neutro para a cor da EMPRESA ser a identidade,
 *     em vez de competir com a nossa.
 *
 *  2. **A cor vem da empresa.** `--primary` é sobrescrito no contentor com a
 *     cor configurada. Tudo o que já usa o token acompanha — botões, focos,
 *     realces — sem uma classe condicional espalhada por três telas.
 *
 *  3. **Os direitos são rodapé, não letra miúda.** A Diretiva (UE) 2019/1937
 *     obriga a informar sobre a via externa (arts. 7.º/2 e 13.º) e sobre a
 *     proteção contra retaliação (arts. 19.º e 21.º). Isso não é aviso legal:
 *     é o que faz alguém decidir falar. Fica visível nas três telas.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconShieldCheck, IconExternal, IconTime } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_OPTIONS } from '@/components/LanguageSelector';
import type { ConfigCanal } from '@/hooks/useCanalDenuncia';
import type { EmpresaPublica } from '@/lib/denuncia-publica';

interface Props {
  empresa: EmpresaPublica | null;
  config: ConfigCanal | null;
  nomeDoCanal: string;
  estiloDaMarca?: React.CSSProperties;
  /** Sub-rótulo abaixo do nome — a tela diz o que é. */
  etapa?: string;
  /** Link de volta; ausente na tela inicial. */
  voltarPara?: string;
  children: ReactNode;
}

/*
  Os idiomas são os mesmos da aplicação — mesma lista, mesma ordem.

  O canal oferecia dois, e um deles chamava-se «PT» servindo pt-BR: o
  português de Portugal existia no produto desde sempre (com dicionário
  próprio, normalizado em `lib/pt-variants`) e era o único sítio onde não
  aparecia. Reutilizar `LOCALE_OPTIONS` evita que volte a divergir.
*/

export function CanalLayout({
  empresa,
  config,
  nomeDoCanal,
  estiloDaMarca,
  etapa,
  voltarPara,
  children,
}: Props) {
  const { t, locale, setLocale } = useLanguage();

  return (
    <div style={estiloDaMarca} className="min-h-screen bg-background">
      {/*
        Cabeçalho de produto, não faixa vazia.

        A identidade da empresa estava repetida ao centro da página enquanto a
        barra de topo levava só três botões de idioma a flutuar à direita. O
        logótipo passa a ancorar a barra — como em qualquer sítio da empresa —
        e a página fica com um título em vez de dois blocos de identidade.
      */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={nomeDoCanal}
                className="max-h-8 max-w-[150px] object-contain"
              />
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">{nomeDoCanal}</span>
            )}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {LOCALE_OPTIONS.map((i) => (
              <button
                key={i.value}
                type="button"
                onClick={() => setLocale(i.value)}
                aria-label={i.label}
                aria-pressed={locale === i.value}
                className={
                  locale === i.value
                    ? 'rounded-md bg-accent px-2 py-1 text-micro font-semibold text-accent-foreground'
                    : 'rounded-md px-2 py-1 text-micro text-muted-foreground transition-ui hover:bg-accent'
                }
              >
                {i.short}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {voltarPara && (
          <Link
            to={voltarPara}
            className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <IconArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            {t('publicPortal.canal.voltar')}
          </Link>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('publicPortal.canal.titulo')}
          </h1>
          {etapa && <p className="mt-0.5 text-sm text-muted-foreground">{etapa}</p>}
        </div>

        {children}

        {/*
          Os direitos de quem denuncia.

          Sem a via externa, o canal interno funciona como funil: retém a
          denúncia e a pessoa não sabe que podia ter ido a outro lado. Sem a
          palavra "retaliação", a promessa de sigilo é a parte fácil.
        */}
        <p className="mb-2 mt-10 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          {t('publicPortal.canal.direitosTitulo')}
        </p>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <IconShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <p className="mt-2 text-xs font-semibold text-foreground">
              {t('publicPortal.canal.direitoSigilo')}
            </p>
            <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
              {config?.permitir_anonimas
                ? t('publicPortal.canal.direitoSigiloAnonimo')
                : t('publicPortal.canal.direitoSigiloIdentificado')}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <IconTime className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <p className="mt-2 text-xs font-semibold text-foreground">
              {t('publicPortal.canal.direitoPrazo')}
            </p>
            <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
              {t('publicPortal.canal.direitoPrazoTexto', {
                acusacao: config?.prazo_acusacao_dias ?? 7,
                retorno: config?.prazo_retorno_dias ?? 90,
              })}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <IconExternal className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <p className="mt-2 text-xs font-semibold text-foreground">
              {t('publicPortal.canal.direitoExterno')}
            </p>
            <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
              {config?.orgao_externo_nome
                ? t('publicPortal.canal.direitoExternoTexto', { orgao: config.orgao_externo_nome })
                : t('publicPortal.canal.direitoExternoSemOrgao')}
            </p>
            {config?.orgao_externo_url && (
              <a
                href={config.orgao_externo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-micro font-medium text-primary hover:underline"
              >
                {config.orgao_externo_nome}
              </a>
            )}
          </div>
        </section>

        {config?.texto_retaliacao && (
          <p className="mt-4 rounded-lg border border-border bg-card p-4 text-micro leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t('publicPortal.canal.retaliacaoTitulo')}{' '}
            </span>
            {config.texto_retaliacao}
          </p>
        )}

        {config?.retencao_meses ? (
          <p className="mt-3 text-micro text-muted-foreground">
            {t('publicPortal.canal.retencao', { meses: config.retencao_meses })}
          </p>
        ) : null}
      </main>
    </div>
  );
}
