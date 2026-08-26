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
  /**
   * A leitura das permissões FALHOU — coisa diferente de «não tem nenhuma».
   *
   * Sem esta distinção, uma rede em baixo dava exactamente o mesmo resultado
   * que uma permissão revogada: lista vazia. E quem lê a lista vazia — o
   * `ProtectedRoute` — dizia à pessoa «Você não tem permissão para acessar
   * este módulo. Entre em contato com o administrador». Um super admin, num
   * soluço de rede, era mandado abrir um pedido de acesso que não resolve
   * nada, num produto onde «acesso negado» tem cheiro a incidente.
   *
   * Continua a fechar a porta — quem não sabe se pode, não passa. Muda só o
   * que se diz a quem está do outro lado dela.
   */
  erroAoLer: boolean;
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
  const [erroAoLer, setErroAoLer] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setErroAoLer(false);
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
      setErroAoLer(false);
    } catch (error) {
      logger.error('Error fetching permissions', { 
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        module: 'permissions'
      });
      setPermissions([]);
      /* Sinaliza a FALHA em vez de a deixar passar por «lista vazia».
         Repare-se no contraste com a leitura do plano, logo abaixo, que
         falha ABERTO de propósito: aqui não se pode fazer o mesmo —
         falhar aberto numa permissão é dar acesso a quem talvez não o
         tenha. Fecha-se na mesma; passa-se é a saber porquê, para o
         poder dizer a quem está do outro lado da porta. */
      setErroAoLer(true);
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
    erroAoLer,
    modulosDoPlano,
    canAccess,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    refetchPermissions,
  };
};