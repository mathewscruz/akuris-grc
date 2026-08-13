import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users } from 'lucide-react';
import { PermissionProfilesList } from './PermissionProfilesList';
import { UserPermissionsList } from './UserPermissionsList';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface PermissionMatrixProps {
  selectedUserId?: string;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ selectedUserId }) => {
  const { t } = useLanguage();
  const [empresaId, setEmpresaId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmpresaId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('user_id', user.id)
          .single();
        if (data?.empresa_id) setEmpresaId(data.empresa_id);
      }
      setLoading(false);
    };
    fetchEmpresaId();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!empresaId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t('configPerms.matrix.empresaNotFound')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Tabs defaultValue={selectedUserId ? 'usuarios' : 'perfis'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfis" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('configPerms.matrix.tabProfiles')}
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('configPerms.matrix.tabUsers')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfis">
          <PermissionProfilesList empresaId={empresaId} />
        </TabsContent>

        <TabsContent value="usuarios">
          <UserPermissionsList empresaId={empresaId} selectedUserId={selectedUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PermissionMatrix;
