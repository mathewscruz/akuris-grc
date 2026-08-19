import { IconWarning, IconShield } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GrcMaturity } from '@/hooks/useGrcMaturityScore';
import { HealthScoreGauge } from './HealthScoreGauge';
import { AkurisMarkPattern } from '@/components/identity/AkurisMarkPattern';
import { CornerAccent } from '@/components/identity/CornerAccent';

interface CriticalBreakdown {
  riscosCriticos: number;
  naoConformidadesCriticas: number;
  incidentesCriticos: number;
  prazosVencidos: number;
}

interface HeroScoreBannerProps {
  maturity: GrcMaturity;
  criticalAlerts: number;
  criticalBreakdown?: CriticalBreakdown;
  activeControls: number;
  userName: string;
  /** Abre o detalhe dos alertas. Sem isto o cartão fica meramente informativo. */
  onAlertsClick?: () => void;
}

export function HeroScoreBanner({
  maturity,
  criticalAlerts,
  criticalBreakdown,
  activeControls,
  userName,
  onAlertsClick,
}: HeroScoreBannerProps) {
  const { t } = useLanguage();

  const alertsTooltip = criticalBreakdown
    ? [
        t('dashboard.criticalAlertsTooltip'),
        `• ${t('dashboard.criticalAlertsRisks')}: ${criticalBreakdown.riscosCriticos}`,
        `• ${t('dashboard.criticalAlertsGaps')}: ${criticalBreakdown.naoConformidadesCriticas}`,
        `• ${t('dashboard.criticalAlertsIncidents')}: ${criticalBreakdown.incidentesCriticos}`,
        `• ${t('dashboard.criticalAlertsOverdue')}: ${criticalBreakdown.prazosVencidos}`,
      ].join('\n')
    : t('dashboard.criticalAlertsTooltip');

  const metrics = [
    {
      icon: IconWarning,
      label: t('dashboard.criticalAlerts'),
      value: criticalAlerts,
      color: criticalAlerts > 0 ? 'text-destructive' : 'text-success',
      title: alertsTooltip as string | undefined,
      // Severidade residual: é o que ainda exige decisão depois dos controlos.
      hint: t('dashboard.criticalAlertsBasis'),
      onClick: onAlertsClick,
    },
    {
      icon: IconShield,
      label: t('dashboard.activeControls'),
      value: activeControls,
      color: 'text-primary',
      title: undefined as string | undefined,
      hint: undefined as string | undefined,
      onClick: undefined as (() => void) | undefined,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-4 md:p-6 lg:p-8">
      {/* Akuris Mark Pattern — assinatura visual */}
      <AkurisMarkPattern opacity={0.05} />
      {/* Corner Accent — chevron de marca */}
      <CornerAccent position="top-left" />

      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <div className="relative flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
        {/* Maturity gauge (semicircular, classic look) */}
        <div className="shrink-0 w-full lg:w-56 flex items-center justify-center">
          <HealthScoreGauge maturity={maturity} />
        </div>

        {/* Content */}
        <div className="flex-1 text-center lg:text-left space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('dashboard.commandCenter')}</p>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground">
              {t('dashboard.hello')}, {userName}
            </h2>
          </div>

          {/* Metrics row */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-3">
            {metrics.map((metric) => {
              const Wrapper = metric.onClick ? 'button' : 'div';
              return (
                <Wrapper
                  key={metric.label}
                  title={metric.title}
                  type={metric.onClick ? 'button' : undefined}
                  onClick={metric.onClick}
                  aria-label={metric.onClick ? `${metric.label}: ${metric.value}` : undefined}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border bg-card/80 backdrop-blur-sm text-left ${
                    metric.onClick
                      ? 'cursor-pointer transition-colors hover:bg-card hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      : ''
                  }`}
                >
                  <metric.icon className={`h-4 w-4 shrink-0 ${metric.color}`} />
                  {/* Rótulo, valor e nota no mesmo corpo de letra. Eram três
                      degraus — xs, sm e micro — num cartão de 90px de largura,
                      e a diferença lia-se como desalinho. Separa o peso. */}
                  <div>
                    <p className="text-micro text-muted-foreground leading-none">{metric.label}</p>
                    <p className={`text-micro font-bold tabular-nums ${metric.color} leading-tight mt-0.5`}>{metric.value}</p>
                    {metric.hint && (
                      <p className="text-micro text-muted-foreground leading-none mt-1">{metric.hint}</p>
                    )}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
