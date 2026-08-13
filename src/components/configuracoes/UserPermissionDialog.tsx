import React, { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle, UserCog } from 'lucide-react';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
interface Module {
  id: string;
  name: string;
  display_name: string;
}

interface PermProfile {
  id: string;
  name: string;
}

interface ModulePerm {
  module_id: string;
  can_access: boolean;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  empresaId: string;
  onSaved: () => void;
}

const PERM_KEYS = ['can_access', 'can_create', 'can_read', 'can_update', 'can_delete'] as const;
const usePermLabels = (t: (k: string) => string): Record<string, string> => ({
  can_access: t('configPerms.userDialog.perm.access'),
  can_create: t('configPerms.userDialog.perm.create'),
  can_read: t('configPerms.userDialog.perm.read'),
  can_update: t('configPerms.userDialog.perm.update'),
  can_delete: t('configPerms.userDialog.perm.delete'),
});

export const UserPermissionDialog: React.FC<Props> = ({
  open, onOpenChange, userId, userName, empresaId, onSaved
}) => {
  const { t } = useLanguage();
  const PERM_LABELS = usePermLabels(t);
  const [profiles, setProfiles] = useState<PermProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('none');
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePerm[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<ModulePerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modulesRes, profilesRes, userPermsRes, userProfileRes] = await Promise.all([
        supabase.from('system_modules').select('id, name, display_name').eq('is_active', true).order('order_index'),
        supabase.from('permission_profiles').select('id, name').eq('empresa_id', empresaId).order('name'),
        supabase.from('user_module_permissions').select('*').eq('user_id', userId),
        supabase.from('profiles').select('permission_profile_id').eq('user_id', userId).single(),
      ]);

      setModules(modulesRes.data || []);
      setProfiles(profilesRes.data || []);

      const currentProfileId = userProfileRes.data?.permission_profile_id;
      setSelectedProfileId(currentProfileId || 'none');

      // Load user permissions
      setPermissions((userPermsRes.data || []).map(p => ({
        module_id: p.module_id,
        can_access: p.can_access,
        can_create: p.can_create,
        can_read: p.can_read,
        can_update: p.can_update,
        can_delete: p.can_delete,
      })));

      // Load profile permissions if user has a profile
      if (currentProfileId) {
        await loadProfilePermissions(currentProfileId);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfilePermissions = async (profileId: string) => {
    const { data } = await supabase
      .from('permission_profile_modules')
      .select('*')
      .eq('profile_id', profileId);

    setProfilePermissions((data || []).map(d => ({
      module_id: d.module_id,
      can_access: d.can_access,
      can_create: d.can_create,
      can_read: d.can_read,
      can_update: d.can_update,
      can_delete: d.can_delete,
    })));
  };

  const handleProfileChange = async (profileId: string) => {
    setSelectedProfileId(profileId);
    if (profileId === 'none') {
      setProfilePermissions([]);
      return;
    }

    await loadProfilePermissions(profileId);

    // Apply profile permissions as current
    const { data } = await supabase
      .from('permission_profile_modules')
      .select('*')
      .eq('profile_id', profileId);

    if (data) {
      setPermissions(data.map(d => ({
        module_id: d.module_id,
        can_access: d.can_access,
        can_create: d.can_create,
        can_read: d.can_read,
        can_update: d.can_update,
        can_delete: d.can_delete,
      })));
    }
  };

  const getPerm = (moduleId: string): ModulePerm => {
    return permissions.find(p => p.module_id === moduleId) || {
      module_id: moduleId, can_access: false, can_create: false, can_read: false, can_update: false, can_delete: false,
    };
  };

  const getProfilePerm = (moduleId: string, key: string): boolean => {
    const pp = profilePermissions.find(p => p.module_id === moduleId);
    return pp ? (pp as any)[key] : false;
  };

  const isCustomized = (moduleId: string, key: string): boolean => {
    if (selectedProfileId === 'none') return false;
    const userVal = (getPerm(moduleId) as any)[key];
    const profileVal = getProfilePerm(moduleId, key);
    return userVal !== profileVal;
  };

  const updatePerm = (moduleId: string, key: string, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.module_id === moduleId);
      if (existing) {
        return prev.map(p => p.module_id === moduleId ? { ...p, [key]: value } : p);
      }
      return [...prev, { module_id: moduleId, can_access: false, can_create: false, can_read: false, can_update: false, can_delete: false, [key]: value }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      // Update profile assignment
      await supabase.from('profiles')
        .update({ permission_profile_id: selectedProfileId === 'none' ? null : selectedProfileId })
        .eq('user_id', userId);

      // Delete existing permissions
      await supabase.from('user_module_permissions').delete().eq('user_id', userId);

      // Insert new permissions
      const toInsert = permissions
        .filter(p => p.can_access || p.can_create || p.can_read || p.can_update || p.can_delete)
        .map(p => ({
          user_id: userId,
          module_id: p.module_id,
          can_access: p.can_access,
          can_create: p.can_create,
          can_read: p.can_read,
          can_update: p.can_update,
          can_delete: p.can_delete,
          granted_by: currentUser?.id,
          granted_at: new Date().toISOString(),
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_module_permissions').insert(toInsert);
        if (error) throw error;
      }

      toast.success(t('configPerms.userDialog.permissionsSaved'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || t('configPerms.userDialog.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const hasCustomizations = modules.some(m =>
    PERM_KEYS.some(k => isCustomized(m.id, k))
  );

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('configPerms.userDialog.cancel')}</Button>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <AkurisPulse size={16} className="mr-2" />}
        {t('configPerms.userDialog.save')}
      </Button>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('configPerms.userDialog.title').replace('{name}', userName)}
      icon={UserCog}
      size="lg"
      footer={footer}
      onSubmit={handleSave}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <AkurisPulse size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>{t('configPerms.userDialog.fieldProfile')}</Label>
            <Select value={selectedProfileId} onValueChange={handleProfileChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('configPerms.userDialog.selectProfilePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('configPerms.userDialog.noProfile')}</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {t('configPerms.userDialog.profileHint')}
            </p>
          </div>

          {hasCustomizations && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t('configPerms.userDialog.customizationsWarning')}
            </div>
          )}

          <Separator />

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">{t('configPerms.userDialog.colModule')}</th>
                  {PERM_KEYS.map(k => (
                    <th key={k} className="text-center px-2 py-2 font-medium">{PERM_LABELS[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map(module => {
                  const perm = getPerm(module.id);
                  return (
                    <tr key={module.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{module.display_name}</td>
                      {PERM_KEYS.map(key => (
                        <td key={key} className="text-center px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Switch
                              checked={perm[key] as boolean}
                              onCheckedChange={v => updatePerm(module.id, key, v)}
                              className="scale-75"
                            />
                            {isCustomized(module.id, key) && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary">
                                ✎
                              </Badge>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DialogShell>
  );
};
