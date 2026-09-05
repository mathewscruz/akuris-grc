import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

/** Only keeps the unfinished report in memory; never writes it to browser storage. */
export function useCanalUnsavedChanges(dirty: boolean) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const onNavigate = (event: MouseEvent<HTMLDivElement>) => {
    if (!dirty || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
    event.preventDefault(); event.stopPropagation();
    setDestination(target.pathname + target.search + target.hash);
  };
  const dialog = <AlertDialog open={!!destination} onOpenChange={(open) => { if (!open) setDestination(null); }}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('canalExperience.leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{t('canalExperience.leaveHint')}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>{t('canalExperience.stay')}</AlertDialogCancel><AlertDialogAction onClick={() => { if (destination) navigate(destination); setDestination(null); }}>{t('canalExperience.leave')}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { onNavigate, dialog };
}
