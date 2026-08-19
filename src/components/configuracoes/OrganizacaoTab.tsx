import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyContextSettings } from './CompanyContextSettings';
import { CompanySlugSettings } from './CompanySlugSettings';
import { CompanyLogoUpload } from './CompanyLogoUpload';
import { EmailTestDialog } from './EmailTestDialog';
import { InstalarAppCard } from './InstalarAppCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconMail } from '@/components/icons';

export function OrganizacaoTab() {
  const { t } = useLanguage();
  const [emailTestDialogOpen, setEmailTestDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <CompanyContextSettings />

      <CompanySlugSettings />

      <CompanyLogoUpload />

      <InstalarAppCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconMail className="h-5 w-5" />
            {t('configGeral.organizacaoTab.emailConfigTitle')}
          </CardTitle>
          <CardDescription>
            {t('configGeral.organizacaoTab.emailConfigDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-medium">{t('configGeral.organizacaoTab.testEmailLabel')}</p>
              <p className="text-sm text-muted-foreground">
                {t('configGeral.organizacaoTab.testEmailDescription')}
              </p>
            </div>
            <Button variant="outline" onClick={() => setEmailTestDialogOpen(true)}>
              <IconMail className="h-4 w-4 mr-2" />
              {t('configGeral.organizacaoTab.testEmailButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmailTestDialog
        open={emailTestDialogOpen}
        onOpenChange={setEmailTestDialogOpen}
      />
    </div>
  );
}