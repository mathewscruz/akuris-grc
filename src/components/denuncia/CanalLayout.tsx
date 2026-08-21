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
import { useLanguage, type Locale } from '@/contexts/LanguageContext';
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

/** Só os idiomas que o produto tem mesmo dicionário para servir. */
const IDIOMAS: { valor: Locale; rotulo: string }[] = [
  { valor: 'pt-BR', rotulo: 'PT' },
  { valor: 'en', rotulo: 'EN' },
];

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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          {voltarPara ? (
            <Link
              to={voltarPara}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <IconArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              {t('publicPortal.canal.voltar')}
            </Link>
          ) : (
            <span />
          )}

          <div className="ml-auto flex items-center gap-1">
            {IDIOMAS.map((i) => (
              <button
                key={i.valor}
                type="button"
                onClick={() => setLocale(i.valor)}
                className={
                  locale === i.valor
                    ? 'rounded-md bg-accent px-2 py-1 text-micro font-semibold text-accent-foreground'
                    : 'rounded-md px-2 py-1 text-micro text-muted-foreground transition-ui hover:bg-accent'
                }
              >
                {i.rotulo}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* A identidade é da empresa: logótipo dela, nome dela. */}
        <div className="mb-8 flex flex-col items-center text-center">
          {empresa?.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={nomeDoCanal}
              className="mb-4 max-h-12 max-w-[220px] object-contain"
            />
          ) : (
            <p className="mb-2 text-xl font-bold text-foreground">{nomeDoCanal}</p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('publicPortal.canal.titulo')}
          </h1>
          {etapa && <p className="mt-1 text-sm text-muted-foreground">{etapa}</p>}
        </div>

        {children}

        {/*
          Os direitos de quem denuncia.

          Sem a via externa, o canal interno funciona como funil: retém a
          denúncia e a pessoa não sabe que podia ter ido a outro lado. Sem a
          palavra "retaliação", a promessa de sigilo é a parte fácil.
        */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
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
          <p className="mt-3 text-center text-micro text-muted-foreground">
            {t('publicPortal.canal.retencao', { meses: config.retencao_meses })}
          </p>
        ) : null}
      </main>
    </div>
  );
}
