import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import GerenciamentoUsuariosEnhanced from './GerenciamentoUsuariosEnhanced';
import { PermissionMatrix } from './PermissionMatrix';
import { ReminderSettings } from './ReminderSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconUsers, IconShield, IconBell } from '@/components/icons';

interface UsersAccessTabProps {
  userRole: string;
  isAdmin: boolean;
  selectedUserId?: string;
}

export function UsersAccessTab({ userRole, isAdmin, selectedUserId }: UsersAccessTabProps) {
  const { t } = useLanguage();
  const defaultSubTab = selectedUserId ? 'permissoes' : 'usuarios';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="h-5 w-5" />
          {t('configPerms.usersAccessTab.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultSubTab}>
          <TabsList>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <IconUsers className="h-4 w-4" />
              {t('configPerms.usersAccessTab.tabUsers')}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="permissoes" className="flex items-center gap-2">
                <IconShield className="h-4 w-4" />
                {t('configPerms.usersAccessTab.tabPermissions')}
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="lembretes" className="flex items-center gap-2">
                <IconBell className="h-4 w-4" />
                {t('configPerms.usersAccessTab.tabReminders')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="usuarios">
            <GerenciamentoUsuariosEnhanced userRole={userRole} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="permissoes">
              <PermissionMatrix selectedUserId={selectedUserId} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="lembretes">
              <ReminderSettings />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}