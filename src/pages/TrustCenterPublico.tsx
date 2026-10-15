import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Progress } from '@/components/ui/progress';

interface TrustData {
  empresa: string; titulo: string | null; descricao: string | null; contato_email: string | null; atualizado_em: string;
  frameworks: { nome: string; nome_en: string | null; conformidade: number }[];
}

export default function TrustCenterPublico() {
  const { slug = '' } = useParams();
  const { t, locale } = useLanguage(); const language = locale.startsWith('en') ? 'en' : 'pt';
  const { data, isLoading } = useQuery({
    queryKey: ['trust-center-publico', slug],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_trust_center_publico' as any, { _slug: slug });
      return data as unknown as TrustData | null;
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><AkurisPulse /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">{t('trustCenter.notFound')}</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Trust Center</p>
          <h1 className="text-3xl font-semibold text-foreground">{data.titulo || data.empresa}</h1>
          {data.descricao && <p className="text-muted-foreground">{data.descricao}</p>}
          <p className="text-xs text-muted-foreground">{t('trustCenter.updated', { date: new Date(data.atualizado_em).toLocaleDateString(language === 'en' ? 'en-US' : 'pt-BR') })}</p>
        </header>
        <section className="space-y-3">
          {data.frameworks.length === 0 && <p className="text-sm text-muted-foreground">{t('trustCenter.noFrameworks')}</p>}
          {data.frameworks.map((f) => (
            <div key={f.nome} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-foreground">{language === 'en' && f.nome_en ? f.nome_en : f.nome}</span>
                <span className="text-sm text-muted-foreground">{t('trustCenter.compliance')} {Number(f.conformidade ?? 0)}%</span>
              </div>
              <Progress value={Number(f.conformidade ?? 0)} />
            </div>
          ))}
        </section>
        {data.contato_email && (
          <a className="inline-block text-sm font-medium text-primary hover:underline" href={`mailto:${data.contato_email}`}>{t('trustCenter.contactCta')}</a>
        )}
        <footer className="pt-8 text-xs text-muted-foreground">{t('trustCenter.poweredBy')}</footer>
      </div>
    </div>
  );
}
