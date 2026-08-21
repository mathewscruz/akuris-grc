/**
 * DenunciaMenu — a porta do canal.
 *
 * Estava assim: dois cartões iguais, lado a lado, "Registrar" e "Consultar",
 * e um terceiro cartão a prometer "Confidencialidade Garantida" sem dizer o
 * que isso significa. Três problemas:
 *
 *  · **Peso igual para coisas de peso diferente.** Quase toda a gente que abre
 *    esta página vem denunciar; consultar um protocolo é o caso raro, e de
 *    quem já esteve aqui antes. Dar-lhes o mesmo tamanho faz a decisão parecer
 *    50/50 e atrasa quem já sabe ao que vem.
 *
 *  · **Uma promessa sem conteúdo.** "Sua identidade será protegida conforme
 *    nossa política de privacidade" não responde ao que a pessoa quer saber:
 *    quem vai ler, em quanto tempo respondem, e o que acontece se houver
 *    retaliação. Isso passou para o rodapé de direitos, no `CanalLayout`.
 *
 *  · **Nada dizia o que se pode denunciar.** Quem hesita, hesita por não saber
 *    se "aquilo" cabe aqui. As categorias configuradas pela empresa respondem
 *    a isso melhor do que qualquer texto.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCanalDenuncia } from '@/hooks/useCanalDenuncia';
import { CanalLayout } from '@/components/denuncia/CanalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { IconFile, IconSearch, IconChevron } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DenunciaMenu() {
  const { empresa: empresaSlug } = useParams();
  const { t } = useLanguage();
  const { empresa, config, carregando, estiloDaMarca, nomeDoCanal } = useCanalDenuncia(empresaSlug);
  const [categorias, setCategorias] = useState<string[]>([]);

  /* O que se pode denunciar, nas palavras da própria empresa. */
  useEffect(() => {
    if (!empresa?.id) return;
    supabase
      .from('denuncias_categorias')
      .select('nome')
      .eq('empresa_id', empresa.id)
      .eq('ativo', true)
      .then(({ data }) => setCategorias((data ?? []).map((c) => c.nome)));
  }, [empresa?.id]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!empresa || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {t('publicPortal.denunciaMenu.companyNotFound')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('publicPortal.denunciaMenu.companyNotFoundDescription')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CanalLayout
      empresa={empresa}
      config={config}
      nomeDoCanal={nomeDoCanal}
      estiloDaMarca={estiloDaMarca}
    >
      {config.texto_apresentacao && (
        <p className="mx-auto mb-6 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          {config.texto_apresentacao}
        </p>
      )}

      {/* A ação principal ocupa o espaço de uma ação principal. */}
      <Link to={`/${empresaSlug}/denuncia/registrar`} className="group block">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 transition-ui hover:border-primary/50 hover:bg-primary/10">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <IconFile className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground">
                {t('publicPortal.denunciaMenu.registerTitle')}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('publicPortal.denunciaMenu.registerDescription')}
              </span>
            </span>
            <IconChevron
              className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </Link>

      {/* Quem vem consultar já esteve aqui: reconhece a linha sem precisar de tamanho. */}
      <Link to={`/${empresaSlug}/denuncia/consulta`} className="group mt-3 block">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 transition-ui hover:bg-accent">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              {t('publicPortal.denunciaMenu.consultTitle')}
            </span>
            <span className="block text-micro text-muted-foreground">
              {t('publicPortal.denunciaMenu.consultDescription')}
            </span>
          </span>
          <IconChevron className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        </div>
      </Link>

      {categorias.length > 0 && (
        <div className="mt-8">
          <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            {t('publicPortal.denunciaMenu.oQueRelatar')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-micro text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-micro text-muted-foreground">
            {t('publicPortal.denunciaMenu.oQueRelatarAjuda')}
          </p>
        </div>
      )}
    </CanalLayout>
  );
}
