import { useLanguage } from '@/contexts/LanguageContext';
import { useMotionPreference } from '@/lib/motion-preferences';
import { IconPause, IconPlay } from '@/components/icons';

export function PublicMotionToggle() {
  const { t } = useLanguage();
  const { selected, systemReduced, setSelected } = useMotionPreference();
  if (systemReduced) return <span className="site-motion-toggle">{t('site.systemMotion')}</span>;
  const Icon = selected ? IconPlay : IconPause;
  return <button type="button" className="site-motion-toggle" aria-pressed={selected} onClick={() => setSelected(!selected)}><Icon size={14} />{t(selected ? 'site.enableMotion' : 'site.pauseMotion')}</button>;
}
