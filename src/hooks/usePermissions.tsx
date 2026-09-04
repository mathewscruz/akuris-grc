import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { logger, measurePerformance } from '@/lib/logger';
import { decidirAcesso } from '@/lib/autorizacao';

interface ModulePermission {
  module_id: string;
  module_name: string;
  can_access: boolean;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

/*
  `usePermissions` é usado pelo layout, rota protegida, menu e atalhos. Cada
  montagem fazia a mesma consulta de permissões e a mesma RPC do plano; no Gap
  Analysis foram observadas várias leituras idênticas em paralelo, todas com
  ~600 ms. Este cache compartilha tanto o resultado quanto a promessa em voo.
*/
let permissionsCache: { userId: string; data: ModulePermission[] } | null = null;
let permissionsInFlight: { userId: string; promise: Promise<ModulePermission[]> } | null = null;
const modulesCache = new Map<string, string[] | null>();
const modulesInFlight = new Map<string, Promise<string[] | null>>();

const readPermissions = (userId: string, force = false): Promise<ModulePermission[]> => {
  if (!force && permissionsCache?.userId === userId) return Promise.resolve(permissionsCache.data);
  if (!force && permissionsInFlight?.userId === userId) return permissionsInFlight.promise;

  const promise = measurePerformance(
    'fetchUserPermissions',
    async () => await supabase
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
        .eq('user_id', userId),
    { userId, module: 'permissions' },
  ).then(({ data, error }) => {
    if (error) throw error;
    const formatted: ModulePermission[] = (data || []).map((perm: any) => ({
      module_id: perm.module_id,
      module_name: perm.system_modules?.name || '',
      can_access: perm.can_access,
      can_create: perm.can_create,
      can_read: perm.can_read,
      can_update: perm.can_update,
      can_delete: perm.can_delete,
    }));
    permissionsCache = { userId, data: formatted };
    logger.info('User permissions loaded', {
      userId,
      permissionsCount: formatted.length,
      module: 'permissions',
    });
    return formatted;
  }).finally(() => {
    if (permissionsInFlight?.promise === promise) permissionsInFlight = null;
  });

  permissionsInFlight = { userId, promise };
  return promise;
};

const readCompanyModules = (empresaId: string): Promise<string[] | null> => {
  if (modulesCache.has(empresaId)) return Promise.resolve(modulesCache.get(empresaId) ?? null);
  const current = modulesInFlight.get(empresaId);
  if (current) return current;
  const promise = (async () => {
    const { data, error } = await supabase.rpc('modulos_da_empresa');
    if (error) throw error;
    const modules = (data as string[] | null) ?? null;
    modulesCache.set(empresaId, modules);
    return modules;
  })().finally(() => modulesInFlight.delete(empresaId));
  modulesInFlight.set(empresaId, promise);
  return promise;
};

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

      const formattedPermissions = await readPermissions(user.id);

      setPermissions(formattedPermissions);
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
    const empresaId = profile?.empresa_id;
    if (!user || !empresaId) {
      setModulosDoPlano(null);
      return;
    }
    readCompanyModules(empresaId).then((data) => {
      if (!vivo) return;
      setModulosDoPlano(data);
    }).catch((error) => {
      if (!vivo) return;
      logger.error('Falha ao ler os módulos do plano', {
        error: error instanceof Error ? error.message : String(error),
        module: 'permissions',
      });
      /* Falhar aberto: um erro de leitura não pode tirar o produto a
         ninguém. Quem manda de verdade é a RLS do banco. */
      setModulosDoPlano(null);
    });
    return () => {
      vivo = false;
    };
  }, [user, profile?.empresa_id]);

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

  const canAccess = useCallback((moduleName: string) => {
    return decidirAcesso({
      papel: profile?.role,
      modulo: moduleName,
      acao: 'access',
      permissao: getPermissionForModule(moduleName),
      modulosDoPlano,
    });
  }, [getPermissionForModule, modulosDoPlano, profile?.role]);

  const canCreate = useCallback((moduleName: string) => {
    return decidirAcesso({ papel: profile?.role, modulo: moduleName, acao: 'create', permissao: getPermissionForModule(moduleName), modulosDoPlano });
  }, [getPermissionForModule, modulosDoPlano, profile?.role]);

  const canRead = useCallback((moduleName: string) => {
    return decidirAcesso({ papel: profile?.role, modulo: moduleName, acao: 'read', permissao: getPermissionForModule(moduleName), modulosDoPlano });
  }, [getPermissionForModule, modulosDoPlano, profile?.role]);

  const canUpdate = useCallback((moduleName: string) => {
    return decidirAcesso({ papel: profile?.role, modulo: moduleName, acao: 'update', permissao: getPermissionForModule(moduleName), modulosDoPlano });
  }, [getPermissionForModule, modulosDoPlano, profile?.role]);

  const canDelete = useCallback((moduleName: string) => {
    return decidirAcesso({ papel: profile?.role, modulo: moduleName, acao: 'delete', permissao: getPermissionForModule(moduleName), modulosDoPlano });
  }, [getPermissionForModule, modulosDoPlano, profile?.role]);

  const refetchPermissions = useCallback(async () => {
    setLoading(true);
    if (user) {
      permissionsCache = null;
      try {
        const fresh = await readPermissions(user.id, true);
        setPermissions(fresh);
        setErroAoLer(false);
      } catch (error) {
        logger.error('Error refetching permissions', {
          error: error instanceof Error ? error.message : String(error),
          userId: user.id,
          module: 'permissions',
        });
        setPermissions([]);
        setErroAoLer(true);
      } finally {
        setLoading(false);
      }
      return;
    }
    await fetchPermissions();
  }, [fetchPermissions, user]);

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
