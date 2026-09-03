import React, { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';
import { IconCheckbox, IconBook, IconShieldCheck } from '@/components/icons';
import { exigirEscrita } from '@/lib/supabase-write';
interface Module {
  id: string;
  name: string;
  display_name: string;
}

interface ModulePermission {
  module_id: string;
  can_access: boolean;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  empresa_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: Profile | null;
  empresaId: string;
  onSaved: () => void;
}

const usePermLabels = (t: (k: string) => string) => [
  { key: 'can_access' as const, label: t('configPerms.profileDialog.perm.access') },
  { key: 'can_create' as const, label: t('configPerms.profileDialog.perm.create') },
  { key: 'can_read' as const, label: t('configPerms.profileDialog.perm.read') },
  { key: 'can_update' as const, label: t('configPerms.profileDialog.perm.update') },
  { key: 'can_delete' as const, label: t('configPerms.profileDialog.perm.delete') },
];

export const PermissionProfileDialog: React.FC<Props> = ({
  open, onOpenChange, profile, empresaId, onSaved
}) => {
  const { t } = useLanguage();
  const PERM_LABELS = usePermLabels(t);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [propagate, setPropagate] = useState(false);

  useEffect(() => {
    if (open) {
      fetchModules();
      if (profile) {
        setName(profile.name);
        setDescription(profile.description || '');
        setIsDefault(profile.is_default);
        fetchProfilePermissions(profile.id);
      } else {
        setName('');
        setDescription('');
        setIsDefault(false);
        setPermissions([]);
        setPropagate(false);
      }
    }
  }, [open, profile]);

  const fetchModules = async () => {
    const { data } = await supabase
      .from('system_modules')
      .select('id, name, display_name')
      .eq('is_active', true)
      .order('order_index');
    setModules(data || []);

    if (!profile) {
      setPermissions((data || []).map(m => ({
        module_id: m.id,
        can_access: false, can_create: false, can_read: false, can_update: false, can_delete: false,
      })));
    }
  };

  const fetchProfilePermissions = async (profileId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('permission_profile_modules')
      .select('*')
      .eq('profile_id', profileId);

    if (data) {
      setPermissions(data.map(d => ({
        module_id: d.module_id,
        can_access: d.can_access, can_create: d.can_create, can_read: d.can_read,
        can_update: d.can_update, can_delete: d.can_delete,
      })));
    }
    setLoading(false);
  };

  const getPermission = (moduleId: string): ModulePermission => {
    return permissions.find(p => p.module_id === moduleId) || {
      module_id: moduleId, can_access: false, can_create: false, can_read: false, can_update: false, can_delete: false,
    };
  };

  const updatePermission = (moduleId: string, key: keyof ModulePermission, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.module_id === moduleId);
      if (existing) {
        return prev.map(p => p.module_id === moduleId ? { ...p, [key]: value } : p);
      }
      return [...prev, { module_id: moduleId, can_access: false, can_create: false, can_read: false, can_update: false, can_delete: false, [key]: value }];
    });
  };

  const setAllPermissions = (value: boolean) => {
    setPermissions(modules.map(m => ({
      module_id: m.id,
      can_access: value, can_create: value, can_read: value, can_update: value, can_delete: value,
    })));
  };

  const setReadOnly = () => {
    setPermissions(modules.map(m => ({
      module_id: m.id,
      can_access: true, can_create: false, can_read: true, can_update: false, can_delete: false,
    })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('configPerms.profileDialog.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      let profileId: string;

      if (profile) {
        const { error } = await supabase
          .from('permission_profiles')
          .update({ name, description, is_default: isDefault, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (error) throw error;
        profileId = profile.id;

        // Delete existing module permissions
        await exigirEscrita(supabase.from('permission_profile_modules').delete().eq('profile_id', profileId));
      } else {
        const { data, error } = await supabase
          .from('permission_profiles')
          .insert({ name, description, is_default: isDefault, empresa_id: empresaId, created_by: (await supabase.auth.getUser()).data.user?.id })
          .select('id')
          .single();
        if (error) throw error;
        profileId = data.id;
      }

      // Insert module permissions
      const modulePerms = permissions
        .filter(p => p.can_access || p.can_create || p.can_read || p.can_update || p.can_delete)
        .map(p => ({ profile_id: profileId, module_id: p.module_id, ...p }));

      if (modulePerms.length > 0) {
        const toInsert = modulePerms.map(({ module_id, can_access, can_create, can_read, can_update, can_delete }) => ({
          profile_id: profileId, module_id, can_access, can_create, can_read, can_update, can_delete,
        }));
        const { error } = await supabase.from('permission_profile_modules').insert(toInsert);
        if (error) throw error;
      }

      // Propagate to all users with this profile
      if (profile && propagate) {
        const { data: usersWithProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('permission_profile_id', profileId);

        if (usersWithProfile) {
          for (const user of usersWithProfile) {
            await supabase.rpc('apply_permission_profile', {
              _user_id: user.user_id,
              _profile_id: profileId,
            });
          }
          toast.success(t('configPerms.profileDialog.propagatedSuccess').replace('{count}', String(usersWithProfile.length)));
        }
      }

      toast.success(profile ? t('configPerms.profileDialog.profileUpdated') : t('configPerms.profileDialog.profileCreated'));
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || t('configPerms.profileDialog.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{t('configPerms.profileDialog.cancel')}</Button>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <AkurisPulse size={16} className="mr-2" />}
        {profile ? t('configPerms.profileDialog.update') : t('configPerms.profileDialog.create')}
      </Button>
    </div>
  );

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={profile ? t('configPerms.profileDialog.titleEdit') : t('configPerms.profileDialog.titleNew')}
      icon={IconShieldCheck}
      size="lg"
      footer={footer}
      onSubmit={handleSave}
      isDirty={!!name}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('configPerms.profileDialog.fieldName')}</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={t('configPerms.profileDialog.fieldNamePlaceholder')} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>{t('configPerms.profileDialog.defaultProfile')}</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('configPerms.profileDialog.fieldDescription')}</Label>
          <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('configPerms.profileDialog.fieldDescriptionPlaceholder')} rows={2} />
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions(true)}>
            <IconCheckbox className="h-3.5 w-3.5 mr-1" />
            {t('configPerms.profileDialog.markAll')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={setReadOnly}>
            <IconBook className="h-3.5 w-3.5 mr-1" />
            {t('configPerms.profileDialog.readOnly')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAllPermissions(false)}>
            <IconCheckbox className="h-3.5 w-3.5 mr-1" />
            {t('configPerms.profileDialog.unmarkAll')}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <AkurisPulse size={24} />
          </div>
        ) : (
          <div
          /*
            `overflow-x-auto`, não `overflow-hidden`.

            São seis colunas -- Módulo + Acessar/Criar/Ler/Editar/Excluir -- e em
            375px o conteúdo mede mais do que a caixa. Com `overflow-hidden` a
            última coluna ficava CORTADA e sem forma de rolar até ela: no
            telemóvel não havia como conceder nem revogar a permissão de
            excluir. O `<main>` da aplicação também esconde o transbordo, por
            isso nem o gesto de rolar a página salvava.
          */
            className="border rounded-lg overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-card">
                  <th className="text-left px-3 py-2 font-medium">{t('configPerms.profileDialog.colModule')}</th>
                  {PERM_LABELS.map(p => (
                    <th key={p.key} className="text-center px-2 py-2 font-medium">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map(module => {
                  const perm = getPermission(module.id);
                  return (
                    <tr key={module.id} className="border-b last:border-0 hover:bg-accent">
                      <td className="px-3 py-2 font-medium">{module.display_name}</td>
                      {PERM_LABELS.map(({ key }) => (
                        <td key={key} className="text-center px-2 py-2">
                          <Switch
                            checked={perm[key] as boolean}
                            onCheckedChange={v => updatePermission(module.id, key, v)}
                            className="scale-75"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {profile && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border">
            <Switch checked={propagate} onCheckedChange={setPropagate} />
            <Label className="text-sm">{t('configPerms.profileDialog.propagateLabel')}</Label>
          </div>
        )}
      </div>
    </DialogShell>
  );
};
