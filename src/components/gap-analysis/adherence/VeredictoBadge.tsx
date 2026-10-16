import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type Veredito = 'em_compliance' | 'com_ressalvas' | 'nao_compliance';

const ESTILO: Record<Veredito, { chip: string; disco: string; glifo: 'check' | 'alerta' | 'x' }> = {
  em_compliance: { chip: 'bg-success/10 text-success border-success/30', disco: 'bg-success', glifo: 'check' },
  com_ressalvas: { chip: 'bg-warning/10 text-warning border-warning/35', disco: 'bg-warning', glifo: 'alerta' },
  nao_compliance: { chip: 'bg-destructive/10 text-destructive border-destructive/30', disco: 'bg-destructive', glifo: 'x' },
};

/** Selo do veredito: cor + ícone próprio por estado, legível mesmo sem cor. */
export function VeredictoBadge({ veredito, className }: { veredito: Veredito; className?: string }) {
  const { t } = useLanguage();
  const e = ESTILO[veredito];
  const icone = (
    <span aria-hidden="true" className={cn('flex h-4 w-4 items-center justify-center rounded-full text-background', e.disco)}>
      <svg viewBox="0 0 12 12" className="!h-2.5 !w-2.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {e.glifo === 'check' && <path d="M3 6.2 5 8.2 9 3.8" />}
        {e.glifo === 'alerta' && <><path d="M6 3v3.6" /><path d="M6 8.8v.1" /></>}
        {e.glifo === 'x' && <path d="M3.8 3.8l4.4 4.4M8.2 3.8 3.8 8.2" />}
      </svg>
    </span>
  );
  return (
    <Chip family="state" icon={icone} className={cn('rounded-full pl-1 pr-2.5 font-semibold [&>span:first-child_svg]:!h-2.5 [&>span:first-child_svg]:!w-2.5', e.chip, className)}>
      {t(`gapAnalysis.adherenceUi.verdict.${veredito}`)}
    </Chip>
  );
}
