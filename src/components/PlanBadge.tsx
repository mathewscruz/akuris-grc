import { IconPackage, IconShield, IconShieldCheck, IconAward, IconStar } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  planCode?: string;
  planName: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

// Maps a plan code or ordering hint to a visual configuration. Falls back gracefully
// for custom plans created by super-admins.
const ICON_MAP: Record<string, React.ElementType> = {
  free: IconPackage,
  trial: IconPackage,
  compliance_start: IconShield,
  starter: IconShield,
  basic: IconShield,
  grc_manager: IconShieldCheck,
  professional: IconShieldCheck,
  pro: IconShieldCheck,
  governaii_enterprise: IconAward,
  enterprise: IconAward,
};

export function PlanBadge({ planCode = '', planName, size = 'md', showName = true }: PlanBadgeProps) {
  const Icon = ICON_MAP[planCode.toLowerCase()] || IconStar;

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const badgeSizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  if (!showName) {
    return (
      <Icon className={`${sizeClasses[size]} shrink-0 text-primary`} />
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border-primary/40 text-primary bg-primary/5',
        badgeSizeClasses[size]
      )}
    >
      <Icon className={sizeClasses[size]} />
      {planName}
    </Badge>
  );
}
