/**
 * SparklineCell — mini gráfico de tendência 52×18 para a tabela de Riscos.
 * Direção derivada do delta entre score residual e inicial:
 *   residual < inicial  → 'down' (melhorando, verde)
 *   residual > inicial  → 'up'   (piorando, vermelho)
 *   sem residual / igual → 'flat' (mute)
 */
import { scoreFromPI } from '@/components/riscos/risk-utils';

interface Props {
  probInicial?: string | null;
  impInicial?: string | null;
  probResidual?: string | null;
  impResidual?: string | null;
}

export function SparklineCell({ probInicial, impInicial, probResidual, impResidual }: Props) {
  const inicial = scoreFromPI(probInicial, impInicial);
  const residual = scoreFromPI(probResidual, impResidual);
  const direction: 'up' | 'down' | 'flat' =
    !residual || residual === inicial ? 'flat' : residual > inicial ? 'up' : 'down';

  const points =
    direction === 'up'
      ? '2,16 12,14 22,12 32,8 42,10 52,4'
      : direction === 'down'
      ? '2,4 12,8 22,10 32,8 42,12 52,16'
      : '2,10 12,9 22,10 32,9 42,10 52,10';

  const stroke =
    direction === 'up'
      ? 'hsl(var(--destructive))'
      : direction === 'down'
      ? 'hsl(var(--success))'
      : 'hsl(var(--muted-foreground))';

  return (
    <svg width="52" height="18" viewBox="0 0 56 20" aria-hidden>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
