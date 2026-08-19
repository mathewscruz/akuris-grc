/**
 * SparklineCell — tendência REAL do score do risco ao longo do tempo.
 *
 * Regra dura (AKURIS): nunca desenhar uma tendência que não existe. Com menos
 * de dois pontos de histórico mostra um traço discreto e "sem histórico".
 * Os pontos vêm de `riscos_historico_avaliacoes` (mesma fonte da aba Histórico).
 */
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Scores ordenados do mais antigo para o mais recente. */
  points?: number[];
}

export function SparklineCell({ points = [] }: Props) {
  const { t } = useLanguage();

  if (points.length < 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden="true" className="h-px w-4 bg-border" />
        <span className="text-micro">{t('riscosVisoes.table.trend.semHistorico')}</span>
      </span>
    );
  }

  const inicio = points[0];
  const fim = points[points.length - 1];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const w = 52;
  const h = 18;
  const coords = points.map((v, ix) => {
    const x = 2 + (ix / (points.length - 1)) * (w - 4);
    const y = 2 + (1 - (v - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke =
    fim < inicio
      ? 'hsl(var(--success))'
      : fim > inicio
      ? 'hsl(var(--destructive))'
      : 'hsl(var(--muted-foreground))';

  const label = t('riscosVisoes.table.trend.tooltip', { pontos: points.length, inicio, fim });

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={t('riscosVisoes.table.trend.aria', { pontos: points.length, inicio, fim })}
    >
      <title>{label}</title>
      <polyline points={coords.join(' ')} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].split(',')[0]} cy={coords[coords.length - 1].split(',')[1]} r="1.8" fill={stroke} />
    </svg>
  );
}
