import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTime, IconBook, IconTarget, IconIdea, IconArrowRight, IconShield, IconScale, IconLock, IconUsers, IconAward, IconDatabase, IconFileCheck, IconGlobe, IconServer, IconOrg, IconSettings, IconLayers } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { fimDoPercurso } from '@/lib/gap-fases';

interface FrameworkOnboardingProps {
  frameworkNome: string;
  frameworkVersao: string;
  frameworkTipo: string;
  totalRequirements: number;
  onStart: () => void;
}

function getOnboardingKey(nome: string): { key: string; icon: React.ReactNode } {
  const lower = nome.toLowerCase();
  const icon = (Comp: any) => <Comp className="h-8 w-8 text-primary" strokeWidth={1.5} />;

  if (lower.includes('iso') && nome.includes('27001')) return { key: 'iso27001', icon: icon(IconShield) };
  if (lower.includes('nist') && !lower.includes('800') && !lower.includes('sp 800')) return { key: 'nist', icon: icon(IconTarget) };
  if (lower.includes('lgpd')) return { key: 'lgpd', icon: icon(IconScale) };
  // `IconLock`, nao `Lock`: `Lock` e a classe Web Locks do navegador, existe em
  // lib.dom.d.ts e por isso compila. Em execucao o React tentava instancia-la e
  // o PCI DSS - 288 requisitos, o maior do catalogo - abria no ErrorBoundary.
  if (lower.includes('pci')) return { key: 'pciDss', icon: icon(IconLock) };
  if (lower.includes('soc')) return { key: 'soc2', icon: icon(IconFileCheck) };
  if (lower.includes('gdpr')) return { key: 'gdpr', icon: icon(IconGlobe) };
  if (lower.includes('hipaa')) return { key: 'hipaa', icon: icon(IconDatabase) };
  if (lower.includes('cis')) return { key: 'cis', icon: icon(IconShield) };
  if (lower.includes('cobit')) return { key: 'cobit', icon: icon(IconLayers) };
  if (lower.includes('sox')) return { key: 'sox', icon: icon(IconOrg) };
  if (lower.includes('nis2') || lower.includes('nis 2')) return { key: 'nis2', icon: icon(IconGlobe) };
  if (lower.includes('27701')) return { key: 'iso27701', icon: icon(IconShield) };
  if (lower.includes('9001')) return { key: 'iso9001', icon: icon(IconAward) };
  if (lower.includes('14001')) return { key: 'iso14001', icon: icon(IconSettings) };
  if (lower.includes('37301')) return { key: 'iso37301', icon: icon(IconScale) };
  if (lower.includes('20000')) return { key: 'iso20000', icon: icon(IconServer) };
  if (lower.includes('31000')) return { key: 'iso31000', icon: icon(IconTarget) };
  if (lower.includes('itil')) return { key: 'itil', icon: icon(IconSettings) };
  if (lower.includes('ccpa')) return { key: 'ccpa', icon: icon(IconScale) };
  if (lower.includes('coso') && lower.includes('erm')) return { key: 'cosoErm', icon: icon(IconTarget) };
  if (lower.includes('coso') && (lower.includes('ic') || lower.includes('interno') || lower.includes('internal'))) return { key: 'cosoIc', icon: icon(IconOrg) };
  if (lower.includes('800-82') || lower.includes('800.82') || lower.includes('sp 800')) return { key: 'nistSp80082', icon: icon(IconSettings) };
  if (lower.includes('dora')) return { key: 'dora', icon: icon(IconOrg) };
  if (lower.includes('62443')) return { key: 'iso62443', icon: icon(IconLayers) };

  return { key: 'generic', icon: icon(IconBook) };
}

export function FrameworkOnboarding({ frameworkNome, frameworkVersao, frameworkTipo, totalRequirements, onStart }: FrameworkOnboardingProps) {
  const { t } = useLanguage();
  const { key, icon } = getOnboardingKey(frameworkNome);
  const ns = `gapExports.onboarding.${key}`;
  const info = {
    icon,
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardContent className="pt-8 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            {info.icon}
          </div>
          <h2 className="text-2xl font-bold mb-2">{frameworkNome} {frameworkVersao}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{info.description}</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="outline" className="gap-1">
              <IconBook className="h-3 w-3" strokeWidth={1.5}/> {t('gapExports.onboardingUi.requirementsBadge', { count: String(totalRequirements) })}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <IconTime className="h-3 w-3" strokeWidth={1.5}/> {info.timeEstimate}
            </Badge>
          </div>
        </CardContent>
      </Card>

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
                  <span className="text-primary mt-0.5">✓</span>
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
                <span className="text-warning mt-0.5">💡</span>
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

      <div className="text-center pb-4">
        <Button size="lg" onClick={onStart} className="gap-2">
          {t('gapExports.onboardingUi.startButton')} <IconArrowRight className="h-4 w-4" strokeWidth={1.5}/>
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {t('gapExports.onboardingUi.aiHint')}
        </p>
      </div>
    </div>
  );
}
