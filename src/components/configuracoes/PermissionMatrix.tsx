import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { PermissionProfilesList } from './PermissionProfilesList';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

interface PermissionMatrixProps {
  selectedUserId?: string;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = () => {
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

  // Permissões só por perfil: cada usuário recebe um perfil; casos especiais ganham um perfil próprio.
  return (
    <div className="rounded-lg bg-card p-4 sm:p-5">
      <PermissionProfilesList empresaId={empresaId} />
    </div>
  );
};
