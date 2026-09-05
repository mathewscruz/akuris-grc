import type { ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconChecklist, IconFileCheck, IconLink, IconUsers, IconHistory, IconTime, IconCheck, IconShieldAlert, IconGlobe } from '@/components/icons';

const areas = [
  { value: 'visao', icon: IconChecklist },
  { value: 'avaliacoes', icon: IconFileCheck },
  { value: 'fluxos', icon: IconLink },
  { value: 'terceiros', icon: IconUsers },
  { value: 'retencao', icon: IconTime },
  { value: 'consentimentos', icon: IconCheck },
  { value: 'incidentes', icon: IconShieldAlert },
  { value: 'portal', icon: IconGlobe },
  { value: 'auditoria', icon: IconHistory },
] as const;

/** A second horizontal tab row competes with the module's primary navigation. */
export function PrivacyProgramNavigation({ value, onValueChange, children }: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <Tabs value={value} onValueChange={onValueChange} orientation="vertical"
      className="grid min-w-0 gap-5 space-y-0 md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <div className="min-w-0 md:hidden">
        <label id="privacy-area-label" className="mb-2 block text-xs font-medium text-muted-foreground">
          {t('experience.privacyArea')}
        </label>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-labelledby="privacy-area-label"><SelectValue /></SelectTrigger>
          <SelectContent>
            {areas.map(({ value: key, icon: Icon }) => (
              <SelectItem key={key} value={key}>
                <span className="inline-flex items-center gap-2"><Icon aria-hidden className="h-4 w-4" />{t(`privacidadePrograma.subtabs.${key}`)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TabsList showIndicator={false} aria-label={t('experience.privacyArea')}
        className="mb-0 hidden h-fit flex-col items-stretch gap-1 overflow-visible rounded-lg border bg-card p-2 md:flex">
        {areas.map(({ value: key, icon: Icon }) => (
          <TabsTrigger key={key} value={key}
            className="m-0 justify-start whitespace-normal rounded-md border-0 px-3 py-3 text-left leading-snug data-[state=active]:bg-primary/5">
            <Icon aria-hidden />{t(`privacidadePrograma.subtabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-w-0">{children}</div>
    </Tabs>
  );
}
