import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger, measurePerformance } from '@/lib/logger';
import { chaveDePlano, SEMPRE_PERMITIDOS } from '@/lib/autorizacao';

interface ModulePermission {
  module_id: string;
  module_name: string;
  can_access: boolean;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface UsePermissionsReturn {
  permissions: ModulePermission[];
  /**
   * Os módulos que o plano da empresa contém, ou `null` quando o plano não
   * restringe. É o teto por EMPRESA que faltava: até aqui o único recorte era
   * a permissão por utilizador, e `planos.modulos_habilitados` era catálogo
   * de preço que ninguém lia.
   */
  modulosDoPlano: string[] | null;
  loading: boolean;
  canAccess: (moduleName: string) => boolean;
  canCreate: (moduleName: string) => boolean;
  canRead: (moduleName: string) => boolean;
  canUpdate: (moduleName: string) => boolean;
  canDelete: (moduleName: string) => boolean;
  refetchPermissions: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsReturn => {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [modulosDoPlano, setModulosDoPlano] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      logger.debug('Fetching user permissions', { userId: user.id, module: 'permissions' });

      const { data, error } = await measurePerformance(
        'fetchUserPermissions',
        () => supabase
          .from('user_module_permissions')
          .select(`
            module_id,
            can_access,
            can_create,
            can_read,
            can_update,
            can_delete,
            system_modules:module_id (
              name
            )
          `)
          .eq('user_id', user.id),
        { userId: user.id, module: 'permissions' }
      );

      if (error) throw error;

      const formattedPermissions: ModulePermission[] = data.map((perm: any) => ({
        module_id: perm.module_id,
        module_name: perm.system_modules?.name || '',
        can_access: perm.can_access,
        can_create: perm.can_create,
        can_read: perm.can_read,
        can_update: perm.can_update,
        can_delete: perm.can_delete,
      }));

      setPermissions(formattedPermissions);
      logger.info('User permissions loaded', { 
        userId: user.id, 
        permissionsCount: formattedPermissions.length,
        module: 'permissions'
      });
    } catch (error) {
      logger.error('Error fetching permissions', { 
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        module: 'permissions'
      });
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /* O teto do plano, resolvido no banco para não depender de o cliente saber
     ler `planos` — a tabela não é legível por quem não é administrador. */
  useEffect(() => {
    let vivo = true;
    if (!user) {
      setModulosDoPlano(null);
      return;
    }
    supabase.rpc('modulos_da_empresa').then(({ data, error }) => {
      if (!vivo) return;
      if (error) {
        logger.error('Falha ao ler os módulos do plano', {
          error: error.message,
          module: 'permissions',
        });
        /* Falhar aberto: um erro de leitura não pode tirar o produto a
           ninguém. Quem manda de verdade é a RLS do banco. */
        setModulosDoPlano(null);
        return;
      }
      setModulosDoPlano((data as string[] | null) ?? null);
    });
    return () => {
      vivo = false;
    };
  }, [user]);

  // Memoizar o mapa de permissões para melhor performance
  const permissionsMap = useMemo(() => {
    const map = new Map<string, ModulePermission>();
    permissions.forEach(permission => {
      map.set(permission.module_name, permission);
    });
    return map;
  }, [permissions]);

  const getPermissionForModule = useCallback((moduleName: string) => {
    return permissionsMap.get(moduleName);
  }, [permissionsMap]);

  /* O plano é teto para todos, super_admin da empresa incluído. */
  const dentroDoPlano = useCallback((moduleName: string) => {
    if (modulosDoPlano === null) return true;
    if (SEMPRE_PERMITIDOS.has(moduleName)) return true;
    return modulosDoPlano.includes(chaveDePlano(moduleName));
  }, [modulosDoPlano]);

  const canAccess = useCallback((moduleName: string) => {
    if (!dentroDoPlano(moduleName)) return false;
    // Super-admin sempre tem acesso total
    if (profile?.role === 'super_admin') return true;

    const permission = getPermissionForModule(moduleName);
    return permission?.can_access || false;
  }, [dentroDoPlano, getPermissionForModule, profile?.role]);

  const canCreate = useCallback((moduleName: string) => {
    // Super-admin sempre tem acesso total
    if (profile?.role === 'super_admin') return true;
    
    const permission = getPermissionForModule(moduleName);
    return permission?.can_create || false;
  }, [getPermissionForModule, profile?.role]);

  const canRead = useCallback((moduleName: string) => {
    // Super-admin sempre tem acesso total
    if (profile?.role === 'super_admin') return true;
    
    const permission = getPermissionForModule(moduleName);
    return permission?.can_read || false;
  }, [getPermissionForModule, profile?.role]);

  const canUpdate = useCallback((moduleName: string) => {
    // Super-admin sempre tem acesso total
    if (profile?.role === 'super_admin') return true;
    
    const permission = getPermissionForModule(moduleName);
    return permission?.can_update || false;
  }, [getPermissionForModule, profile?.role]);

  const canDelete = useCallback((moduleName: string) => {
    // Super-admin sempre tem acesso total
    if (profile?.role === 'super_admin') return true;
    
    const permission = getPermissionForModule(moduleName);
    return permission?.can_delete || false;
  }, [getPermissionForModule, profile?.role]);

  const refetchPermissions = useCallback(async () => {
    setLoading(true);
    await fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    loading,
    modulosDoPlano,
    canAccess,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    refetchPermissions,
  };
};