import React from 'react';
import { Chip, type ChipFamily, type ChipTone, type SeverityLevel, type StateLevel } from '@/components/ui/chip';

/**
 * StatusBadge — mantém a API histórica, mas delega no componente único `Chip`
 * (Envio 9). Assim toda a aplicação passa a ter UM só tratamento de pílula:
 * mesmo peso, raio, altura e tamanho de letra. Não há mais versões "sólidas"
 * a competir com versões "suaves" dentro da mesma escala.
 *
 * Regra de cor:
 *  - Com `mark` (C/A/M/B) → família SEVERIDADE, escala semântica.
 *  - Sem `mark` → família ESTADO, tinta neutra; estados concluídos usam teal e
 *    bloqueados/vencidos usam vermelho porque exigem ação.
 *
 * Use sempre via resolvers em `src/lib/status-tone.tsx`.
 */

export type StatusTone =
  | 'success'
  | 'warning'
  | 'orange'
  | 'destructive'
  | 'info'
  | 'neutral'
  | 'primary';

export type StatusVariant = 'soft' | 'solid' | 'outline';
export type StatusSize = 'sm' | 'md';
export type StatusIntensity = 'normal' | 'high';

interface StatusBadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  /** Aceite por compatibilidade — o chip tem agora um só peso visual. */
  variant?: StatusVariant;
  /** Aceite por compatibilidade — a distinção é feita pela escala de severidade. */
  intensity?: StatusIntensity;
  /** Letra curta redundante à cor (WCAG 1.4.1): C/A/M/B na severidade. */
  mark?: string;
  /** `type` = taxonomia: sai da pílula e vira texto. Vem dos resolvers. */
  family?: 'type';
}

const SEVERITY_FROM_TONE: Record<StatusTone, SeverityLevel> = {
  destructive: 'critical',
  orange: 'high',
  warning: 'medium',
  success: 'low',
  info: 'none',
  primary: 'none',
  neutral: 'none',
};

const STATE_FROM_TONE: Record<StatusTone, StateLevel> = {
  success: 'done',
  warning: 'attention',
  orange: 'attention',
  destructive: 'blocked',
  info: 'rest',
  primary: 'rest',
  neutral: 'rest',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone = 'neutral',
  children,
  icon,
  className,
  mark,
  family: familyProp,
}) => {
  const family: ChipFamily = familyProp ?? (mark ? 'severity' : 'state');
  const chipTone: ChipTone = mark ? SEVERITY_FROM_TONE[tone] : STATE_FROM_TONE[tone];

  return (
    <Chip family={family} tone={chipTone} mark={mark} icon={icon} className={className}>
      {children}
    </Chip>
  );
};
