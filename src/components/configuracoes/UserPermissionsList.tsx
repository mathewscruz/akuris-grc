import React, { useState, useEffect } from 'react';
import { IconSearch, IconShield, IconUsers } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { UserPermissionDialog } from './UserPermissionDialog';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface User {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  permission_profile_id: string | null;
  profile_name: string | null;
}

interface Props {
  empresaId: string;
  selectedUserId?: string;
}

export const UserPermissionsList: React.FC<Props> = ({ empresaId, selectedUserId }) => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome, email, role, permission_profile_id')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // Fetch profile names
      const profileIds = [...new Set((data || []).map(u => u.permission_profile_id).filter(Boolean))];
      const profileMap = new Map<string, string>();

      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('permission_profiles')
          .select('id, name')
          .in('id', profileIds);

        profilesData?.forEach(p => profileMap.set(p.id, p.name));
      }

      setUsers((data || []).map(u => ({
        ...u,
        profile_name: u.permission_profile_id ? profileMap.get(u.permission_profile_id) || null : null,
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('configPerms.usersList.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [empresaId]);

  useEffect(() => {
    if (selectedUserId && users.length > 0) {
      const user = users.find(u => u.user_id === selectedUserId);
      if (user) {
        setSelectedUser(user);
        setDialogOpen(true);
      }
    }
  }, [selectedUserId, users]);

  const filteredUsers = users.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: t('configPerms.usersList.role.super_admin'),
      admin: t('configPerms.usersList.role.admin'),
      user: t('configPerms.usersList.role.user'),
      readonly: t('configPerms.usersList.role.readonly'),
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <AkurisPulse size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{t('configPerms.usersList.sectionTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('configPerms.usersList.sectionSummary', { shown: filteredUsers.length, total: users.length })}</p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('configPerms.usersList.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-background pl-9"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <IconUsers className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('configPerms.usersList.emptyState')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card divide-y divide-border/70">
          {filteredUsers.map(user => (
            <div key={user.user_id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-gradient-to-r hover:from-primary/[0.055] hover:via-primary/[0.025] hover:to-transparent sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                  {user.nome.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{user.nome}</div>
                  <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:shrink-0">
                <Badge variant="outline" className="text-xs hidden sm:flex">
                  {getRoleLabel(user.role)}
                </Badge>

                {user.profile_name ? (
                  <Badge variant="secondary" className="text-xs">
                    <IconShield className="h-3 w-3 mr-1" />
                    {user.profile_name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {t('configPerms.usersList.roleFallbackBadge', { role: getRoleLabel(user.role) })}
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedUser(user); setDialogOpen(true); }}
                >
                  {t('configPerms.usersList.manage')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <UserPermissionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={selectedUser.user_id}
          userName={selectedUser.nome}
          empresaId={empresaId}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
};
