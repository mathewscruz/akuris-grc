import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { Button } from '@/components/ui/button';

export default function ResponderAviso() {
  const { token = '' } = useParams();
  const { t } = useLanguage();
  const [feito, setFeito] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['responder-aviso', token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('email-action', { body: { token } });
      if (error) return { erro: true } as const;
      return data as { plano: { titulo: string; prazo: string | null; status: string } };
    },
  });

  const agir = async (acao: 'concluir' | 'adiar') => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('email-action', { body: { token, acao } });
    setBusy(false);
    setFeito(error ? 'erro' : acao);
  };

  const wrap = (c: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6">{c}</div>
    </div>
  );

  if (isLoading) return wrap(<div className="flex justify-center"><AkurisPulse /></div>);
  if (!data || 'erro' in data) return wrap(<p className="text-sm text-muted-foreground">{t('responderAviso.invalido')}</p>);
  if (feito) return wrap(<p className="text-sm text-foreground">{t(`responderAviso.feito.${feito}`)}</p>);

  return wrap(
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('responderAviso.eyebrow')}</p>
      <h1 className="text-xl font-semibold text-foreground">{data.plano.titulo}</h1>
      <p className="text-sm text-muted-foreground">{t('responderAviso.prazo', { date: data.plano.prazo ?? '-' })}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={busy} onClick={() => agir('concluir')}>{t('responderAviso.concluir')}</Button>
        <Button disabled={busy} variant="outline" onClick={() => agir('adiar')}>{t('responderAviso.adiar')}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('responderAviso.unico')}</p>
    </>,
  );
}
