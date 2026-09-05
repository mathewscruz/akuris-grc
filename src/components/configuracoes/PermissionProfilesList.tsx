import React, { useState, useEffect } from 'react';
import { IconAdd, IconEdit, IconDelete, IconUsers, IconShield, IconStar } from '@/components/icons';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { PermissionProfileDialog } from './PermissionProfileDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { exigirEscrita } from '@/lib/supabase-write';
interface Profile {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  empresa_id: string;
  user_count: number;
}

interface Props {
  empresaId: string;
}

export const PermissionProfilesList: React.FC<Props> = ({ empresaId }) => {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error } = await supabase
        .from('permission_profiles')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('name');

      if (error) throw error;

      // Count users per profile
      const { data: usersData } = await supabase
        .from('profiles')
        .select('permission_profile_id')
        .eq('empresa_id', empresaId)
        .not('permission_profile_id', 'is', null);

      const countMap = new Map<string, number>();
      usersData?.forEach(u => {
        const pid = u.permission_profile_id;
        if (pid) countMap.set(pid, (countMap.get(pid) || 0) + 1);
      });

      setProfiles((profilesData || []).map(p => ({
        ...p,
        user_count: countMap.get(p.id) || 0,
      })));
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error(t('configPerms.profilesList.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) fetchProfiles();
  }, [empresaId]);

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;
    try {
      // Clear profile reference from users first
      await exigirEscrita(supabase
        .from('profiles')
        .update({ permission_profile_id: null })
        .eq('permission_profile_id', profileToDelete.id));

      const { error } = await supabase
        .from('permission_profiles')
        .delete()
        .eq('id', profileToDelete.id);
      if (error) throw error;

      toast.success(t('configPerms.profilesList.profileDeleted'));
      fetchProfiles();
    } catch (error: any) {
      toast.error(error.message || t('configPerms.profilesList.errorDelete'));
    } finally {
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
    }
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
          <p className="text-sm font-semibold text-foreground">{t('configPerms.profilesList.sectionTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('configPerms.profilesList.sectionSummary', { count: profiles.length })}</p>
        </div>
        <Button onClick={() => { setEditingProfile(null); setDialogOpen(true); }}>
          <IconAdd className="h-4 w-4 mr-2" />
          {t('configPerms.profilesList.newProfile')}
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <IconShield className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t('configPerms.profilesList.emptyTitle')}</p>
          <p className="text-sm">{t('configPerms.profilesList.emptyDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map(profile => (
            <Card key={profile.id} className="group overflow-hidden border-border/80 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm">
              <div className="h-1 bg-gradient-to-r from-primary/70 via-primary/25 to-transparent" />
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
                      <IconShield className="h-4 w-4" />
                    </span>
                    <h3 className="font-semibold">{profile.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <IconStar className="h-3 w-3 mr-1" />
                        {t('configPerms.profilesList.defaultBadge')}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="mb-4 min-h-10 text-sm leading-relaxed text-muted-foreground">
                  {profile.description || t('configPerms.profilesList.noDescription')}
                </p>

                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    <IconUsers className="h-3 w-3 mr-1" />
                    {t('configPerms.profilesList.userCount').replace('{count}', String(profile.user_count))}
                  </Badge>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)} aria-label={t('configPerms.profilesList.edit')}>
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setProfileToDelete(profile); setDeleteDialogOpen(true); }}
                      className="text-destructive hover:text-destructive"
                      aria-label={t('configPerms.profilesList.deleteAction')}
                    >
                      <IconDelete className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PermissionProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editingProfile}
        empresaId={empresaId}
        onSaved={fetchProfiles}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('configPerms.profilesList.deleteTitle')}
        description={t('configPerms.profilesList.deleteDescription').replace('{name}', profileToDelete?.name || '')}
        confirmText={t('configPerms.profilesList.deleteConfirm')}
        cancelText={t('configPerms.profilesList.deleteCancel')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
};
