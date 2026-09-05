import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTime, IconBook, IconTarget, IconIdea, IconArrowRight, IconUsers, IconAward, IconCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { fimDoPercurso } from '@/lib/gap-fases';
import { FrameworkBadge } from '@/components/frameworks/FrameworkBadge';

interface FrameworkOnboardingProps {
  frameworkNome: string;
  frameworkVersao: string;
  frameworkTipo: string;
  totalRequirements: number;
  onStart: () => void;
  /** Abre o assistente de escopo. Ausente quando o framework ainda não o tem. */
  onEscopo?: () => void;
}

function getOnboardingKey(nome: string): string {
  const lower = nome.toLowerCase();

  if (lower.includes('iso') && nome.includes('27001')) return 'iso27001';
  if (lower.includes('nist') && !lower.includes('800') && !lower.includes('sp 800')) return 'nist';
  if (lower.includes('lgpd')) return 'lgpd';
  if (lower.includes('pci')) return 'pciDss';
  if (lower.includes('soc')) return 'soc2';
  if (lower.includes('gdpr')) return 'gdpr';
  if (lower.includes('hipaa')) return 'hipaa';
  if (lower.includes('cis')) return 'cis';
  if (lower.includes('cobit')) return 'cobit';
  if (lower.includes('sox')) return 'sox';
  if (lower.includes('nis2') || lower.includes('nis 2')) return 'nis2';
  if (lower.includes('27701')) return 'iso27701';
  if (lower.includes('9001')) return 'iso9001';
  if (lower.includes('14001')) return 'iso14001';
  if (lower.includes('37301')) return 'iso37301';
  if (lower.includes('20000')) return 'iso20000';
  if (lower.includes('31000')) return 'iso31000';
  if (lower.includes('itil')) return 'itil';
  if (lower.includes('ccpa')) return 'ccpa';
  if (lower.includes('coso') && lower.includes('erm')) return 'cosoErm';
  if (lower.includes('coso') && (lower.includes('ic') || lower.includes('interno') || lower.includes('internal'))) return 'cosoIc';
  if (lower.includes('800-82') || lower.includes('800.82') || lower.includes('sp 800')) return 'nistSp80082';
  if (lower.includes('dora')) return 'dora';
  if (lower.includes('62443')) return 'iso62443';

  return 'generic';
}

export function FrameworkOnboarding({ frameworkNome, frameworkVersao, frameworkTipo, totalRequirements, onStart, onEscopo }: FrameworkOnboardingProps) {
  const { t } = useLanguage();
  const key = getOnboardingKey(frameworkNome);
  const ns = `gapExports.onboarding.${key}`;
  const info = {
    description: key === 'generic'
      ? t(`${ns}.description`, { total: totalRequirements })
      : t(`${ns}.description`),
    timeEstimate: key === 'generic'
      ? t(`${ns}.timeEstimate`, { min: String(Math.ceil(totalRequirements / 10)), max: String(Math.ceil(totalRequirements / 5)) })
      : t(`${ns}.timeEstimate`),
    steps: [t(`${ns}.step1`), t(`${ns}.step2`), t(`${ns}.step3`), t(`${ns}.step4`)],
    quickTips: [t(`${ns}.tip1`), t(`${ns}.tip2`), t(`${ns}.tip3`)],
  };
  const benefits = {
    audience: t(`${ns}.audience`),
    benefits: [t(`${ns}.benefit1`), t(`${ns}.benefit2`), t(`${ns}.benefit3`), t(`${ns}.benefit4`)],
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardContent className="p-5 text-left">
          <div className="mb-4 inline-flex items-center justify-center">
            <FrameworkBadge
              name={frameworkNome}
              versao={frameworkVersao}
              tipo={frameworkTipo}
              size="lg"
            />
          </div>
          <h2 className="text-xl font-semibold mb-2">{frameworkNome} {frameworkVersao}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{info.description}</p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconBook className="h-3 w-3" strokeWidth={1.5}/> {t('gapExports.onboardingUi.requirementsBadge', { count: String(totalRequirements) })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconTime className="h-3 w-3" strokeWidth={1.5}/> {info.timeEstimate}
            </span>
          </div>
        </CardContent>
      </Card>

      {/*
          A ação principal precisa aparecer antes do material de referência.
          No fluxo anterior ela vinha depois de cinco cartões e ficava mais de
          uma tela abaixo da dobra; quem só queria começar precisava adivinhar
          que havia um botão no fim da página.
      */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 text-center">
        {onEscopo ? (
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" onClick={onEscopo} className="gap-2">
              {t('gapEscopo.conviteBotao')} <IconArrowRight className="h-4 w-4" strokeWidth={1.5}/>
            </Button>
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">
              {t('gapEscopo.conviteTexto', { total: totalRequirements })}
            </p>
            <Button variant="ghost" size="sm" onClick={onStart} className="text-xs text-muted-foreground">
              {t('gapEscopo.irDireto')}
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={onStart} className="gap-2">
            {t('gapExports.onboardingUi.startButton')} <IconArrowRight className="h-4 w-4" strokeWidth={1.5}/>
          </Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t('gapExports.onboardingUi.aiHint')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IconUsers className="h-5 w-5 text-primary" strokeWidth={1.5}/>
              {t('gapExports.onboardingUi.audienceTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{benefits.audience}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IconAward className="h-5 w-5 text-primary" strokeWidth={1.5}/>
              {t('gapExports.onboardingUi.benefitsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {benefits.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconTarget className="h-5 w-5 text-primary" strokeWidth={1.5}/>
            {t('gapExports.onboardingUi.roadmapTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {info.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm">{step}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconIdea className="h-5 w-5 text-warning" strokeWidth={1.5}/>
            {t('gapExports.onboardingUi.tipsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {info.quickTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <IconIdea className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/*
          O que é certificar-se.

          O produto pedia a data-alvo da certificação sem nunca ter dito que
          existe um organismo certificador a contratar, que a auditoria tem dois
          estágios e que o certificado tem validade. Quem nunca passou por isto
          não descobria em lado nenhum do produto.
      */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconAward className="h-5 w-5 text-primary" strokeWidth={1.5}/>
            {t(`gapV2.certificacao.titulo_${fimDoPercurso(frameworkNome)}`)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted-foreground">
            {/*
                Um texto por familia, e nao um para todos.

                A versao anterior dizia a toda a gente "contrate um organismo
                certificador, o certificado vale tres anos". Quem abrisse a LGPD
                lia isso — e nao existe certificado de LGPD. O SOC 2 tambem nao
                da certificado: da um relatorio de auditor. Dizer o contrario a
                quem nunca passou por isto e' mandar a pessoa procurar uma coisa
                que nao existe.
            */}
            {t(`gapV2.certificacao.oQueE_${fimDoPercurso(frameworkNome)}`)}
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
