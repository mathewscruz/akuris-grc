import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fetchPlanos, formatBRL, type Plano } from '@/lib/planos-utils';
import { PlanBadge } from '@/components/PlanBadge';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
export default function PlanosAssinatura() {
  const { t } = useLanguage();
  const [isAnnual, setIsAnnual] = useState(false);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlanos()
      .then(setPlanos)
      .catch(() => setPlanos([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <AkurisPulse size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      <div className="flex justify-start">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> {t('cardsKpi.sweep.sistema.voltar')}</Link>
        </Button>
      </div>
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          {t('sweepCore.planosAssinatura.titulo')}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t('sweepCore.planosAssinatura.subtitulo')}
        </p>

        {planos.some(p => p.preco_anual > 0) && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Label htmlFor="billing-toggle" className={cn('text-sm', !isAnnual && 'text-foreground font-medium')}>
              {t('sweepCore.planosAssinatura.mensal')}
            </Label>
            <Switch id="billing-toggle" checked={isAnnual} onCheckedChange={setIsAnnual} />
            <Label htmlFor="billing-toggle" className={cn('text-sm', isAnnual && 'text-foreground font-medium')}>
              {t('sweepCore.planosAssinatura.anual')}
            </Label>
            {isAnnual && (
              <Badge variant="secondary">{t('sweepCore.planosAssinatura.economize')}</Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {planos.map((plano) => {
          const monthlyPrice = isAnnual && plano.preco_anual > 0
            ? Math.round(plano.preco_anual / 12)
            : plano.preco_mensal;
          const isPopular = plano.is_destaque;

          return (
            <Card
              key={plano.id}
              className={cn(
                'relative flex flex-col transition-all duration-200 hover:shadow-lg',
                isPopular && 'border-primary shadow-md scale-[1.02]'
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    <Sparkles className="h-3 w-3 mr-1" /> {t('sweepCore.planosAssinatura.maisPopular')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2 pt-6 space-y-3">
                <div className="flex justify-center">
                  <PlanBadge planCode={plano.codigo} planName={plano.nome} showName={false} size="lg" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{plano.nome}</h3>
                {plano.descricao && (
                  <p className="text-sm text-muted-foreground">{plano.descricao}</p>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">{formatBRL(monthlyPrice)}</span>
                    <span className="text-muted-foreground">{t('sweepCore.planosAssinatura.porMes')}</span>
                  </div>
                  {isAnnual && plano.preco_anual > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('sweepCore.planosAssinatura.cobradoAnualmente', { valor: formatBRL(plano.preco_anual) })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('sweepCore.planosAssinatura.creditosLimite', {
                      creditos: plano.creditos_franquia,
                      limite: plano.limite_usuarios
                        ? t('sweepCore.planosAssinatura.ateUsuarios', { n: plano.limite_usuarios })
                        : t('sweepCore.planosAssinatura.usuariosIlimitados'),
                    })}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {plano.recursos_destacados.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="pt-4">
                <Button asChild className="w-full" variant={isPopular ? 'default' : 'outline'} size="lg">
                  <a href="mailto:contato@akuris.com.br?subject=Interesse%20em%20um%20plano%20Akuris">
                    {t('sweepCore.planosAssinatura.falarComTime')}
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>{t('residuos.geral.precisaCustomizado')}<a href="mailto:contato@akuris.com.br" className="text-primary hover:underline">{t('residuos.geral.faleConosco')}</a>.</p>
      </div>
    </div>
  );
}
