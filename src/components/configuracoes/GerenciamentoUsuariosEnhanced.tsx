import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, UserCheck, User, Clock, MoreHorizontal, Shield, Mail, Users, ShieldCheck, Key, Copy } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PermissionMatrix } from './PermissionMatrix';
import { DataTable, Column, Filter } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { formatDateOnly, formatDateTime } from '@/lib/date-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { useLanguage } from '@/contexts/LanguageContext';

const makeUsuarioSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('admin.usuarios.zodNomeRequired')),
  email: z.string().email(t('admin.usuarios.zodEmailInvalid')),
  role: z.enum(['super_admin', 'admin', 'user', 'readonly']),
  empresa_id: z.string().optional(),
  permission_profile_id: z.string().optional(),
});

type UsuarioForm = z.infer<ReturnType<typeof makeUsuarioSchema>>;

interface PermissionProfile {
  id: string;
  name: string;
  empresa_id?: string | null;
}

interface Usuario {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  empresa_id?: string;
  foto_url?: string;
  created_at: string;
  permission_profile_id?: string;
  invitation_sent_at?: string | null;
  invitation_link?: string | null;
  empresas?: {
    nome: string;
  };
  permission_profiles?: {
    name: string;
  };
}

interface UserAccessInfo {
  user_id: string;
  last_sign_in_at: string | null;
  created_at: string;
  has_temp_password: boolean;
  temp_password_created_at?: string;
  temp_password_expires_at?: string;
  first_access_pending: boolean;
}

interface Empresa {
  id: string;
  nome: string;
}

interface Props {
  userRole: string;
}

const GerenciamentoUsuariosEnhanced = ({ userRole }: Props) => {
  const { t } = useLanguage();
  const usuarioSchema = useMemo(() => makeUsuarioSchema(t), [t]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [permissionProfiles, setPermissionProfiles] = useState<PermissionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<Usuario | null>(null);
  const [usersAccessInfo, setUsersAccessInfo] = useState<Map<string, UserAccessInfo>>(new Map());
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<string | undefined>();
  const [restoringPermissions, setRestoringPermissions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<string>('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const form = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nome: '',
      email: '',
      role: 'user',
      empresa_id: '',
      permission_profile_id: '',
    },
  });

  const isSuperAdmin = userRole === 'super_admin';

  const fetchUsuarios = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id, user_id, nome, email, role, ativo, empresa_id, foto_url,
          created_at, permission_profile_id, invitation_sent_at,
          empresas ( nome ),
          permission_profiles ( name )
        `)
        .order('nome');

      if (!isSuperAdmin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (profile?.empresa_id) {
          query = query.eq('empresa_id', profile.empresa_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const usuariosData = data.map((usuario: any) => ({
        id: usuario.id,
        user_id: usuario.user_id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        ativo: usuario.ativo,
        empresa_id: usuario.empresa_id,
        foto_url: usuario.foto_url,
        created_at: usuario.created_at,
        permission_profile_id: usuario.permission_profile_id,
        invitation_sent_at: usuario.invitation_sent_at ?? null,
        invitation_link: null,
        empresas: usuario.empresas,
        permission_profiles: usuario.permission_profiles,
      }));

      setUsuarios(usuariosData);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error(t('admin.usuarios.toastErrorFetch'));
    }
  };

  const fetchUsersAccessInfo = async (userIds: string[]) => {
    if (!userIds || userIds.length === 0) {
      setUsersAccessInfo(new Map());
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-user-access-info', {
        body: { user_ids: userIds }
      });
      
      if (error) throw error;
      
      const accessMap = new Map<string, UserAccessInfo>();
      const users = data?.users || [];
      users.forEach((info: UserAccessInfo) => {
        accessMap.set(info.user_id, info);
      });
      setUsersAccessInfo(accessMap);
    } catch (error) {
      console.error('Erro ao buscar informações de acesso:', error);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setEmpresas(data || []);
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    }
  };

  /**
   * Carrega os perfis de permissão da empresa DE DESTINO (a escolhida no
   * formulário), não da empresa do utilizador autenticado. Sem isto, um
   * super-admin a criar um utilizador noutra empresa envia um perfil de outra
   * empresa e a edge function rejeita ("Perfil de permissão não pertence à
   * empresa de destino").
   */
  const fetchPermissionProfiles = async (empresaIdAlvo?: string | null) => {
    try {
      let empresaId = empresaIdAlvo || null;

      if (!empresaId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        empresaId = profile?.empresa_id || null;
      }

      if (!empresaId) {
        setPermissionProfiles([]);
        return;
      }

      const { data, error } = await supabase
        .from('permission_profiles')
        .select('id, name, empresa_id')
        // perfis da empresa de destino + perfis globais (empresa_id nulo)
        .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
        .order('name');

      if (error) throw error;
      setPermissionProfiles((data || []) as PermissionProfile[]);
    } catch (error) {
      console.error('Erro ao buscar perfis de permissão:', error);
      setPermissionProfiles([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchUsuarios(), fetchEmpresas(), fetchPermissionProfiles()]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Recarrega os perfis sempre que a empresa selecionada no formulário mudar
  const empresaSelecionada = form.watch('empresa_id');
  useEffect(() => {
    if (!dialogOpen) return;
    fetchPermissionProfiles(empresaSelecionada || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaSelecionada, dialogOpen]);

  // Se o perfil escolhido deixar de existir na empresa selecionada, limpa-o
  useEffect(() => {
    const atual = form.getValues('permission_profile_id');
    if (!atual) return;
    if (permissionProfiles.length === 0) return;
    if (!permissionProfiles.some((p) => p.id === atual)) {
      form.setValue('permission_profile_id', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionProfiles]);


  useEffect(() => {
    if (usuarios.length > 0) {
      const userIds = usuarios.map(u => u.user_id);
      fetchUsersAccessInfo(userIds);
    }
  }, [usuarios]);

  const filteredUsuarios = usuarios.filter((usuario) => {
    const matchesSearch = usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmpresa = filterEmpresa === 'all' || usuario.empresa_id === filterEmpresa;
    const matchesRole = filterRole === 'all' || usuario.role === filterRole;
    
    return matchesSearch && matchesEmpresa && matchesRole;
  });

  // Stats
  const stats = {
    total: usuarios.length,
    active: usuarios.filter(u => {
      const info = usersAccessInfo.get(u.user_id);
      return info?.last_sign_in_at;
    }).length,
    pending: usuarios.filter(u => {
      const info = usersAccessInfo.get(u.user_id);
      return info?.first_access_pending;
    }).length,
    admins: usuarios.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
  };

  const handleSubmit = async (data: UsuarioForm) => {
    try {
      setCreating(true);
      
      if (editingUsuario) {
        const profileId = data.permission_profile_id || null;
        const { error } = await supabase
          .from('profiles')
          .update({
            nome: data.nome,
            email: data.email,
            role: data.role,
            empresa_id: data.empresa_id || null,
            permission_profile_id: profileId,
          })
          .eq('user_id', editingUsuario.user_id);

        if (error) throw error;

        // Aplicar permissões do perfil se selecionado
        if (profileId) {
          await supabase.rpc('apply_permission_profile', {
            _profile_id: profileId,
            _user_id: editingUsuario.user_id,
          } as any);
        }

        toast.success(t('admin.usuarios.toastUserUpdated'));
      } else {
        // Validação preventiva: perfil tem de pertencer à empresa de destino
        const perfilEscolhido = data.permission_profile_id
          ? permissionProfiles.find((p) => p.id === data.permission_profile_id)
          : null;
        if (data.permission_profile_id && !perfilEscolhido) {
          toast.error(t('admin.usuarios.erroPerfilOutraEmpresa'));
          return;
        }

        const { data: resposta, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: data.email,
            nome: data.nome,
            role: data.role,
            empresa_id: data.empresa_id || null,
            permission_profile_id: data.permission_profile_id || null,
          }
        });

        if (error) {
          const detalhe = await extrairMensagemEdge(error);
          if (detalhe?.includes('DUPLICATE_USER') || detalhe?.includes('already been registered')) {
            toast.error(t('admin.usuarios.toastUserExists', { email: data.email }));
            return;
          }
          if (detalhe?.includes('não pertence à empresa')) {
            toast.error(t('admin.usuarios.erroPerfilOutraEmpresa'));
            return;
          }
          toast.error(detalhe || error.message || t('admin.usuarios.toastErrorSave'));
          return;
        }
        if ((resposta as any)?.error) {
          toast.error((resposta as any).message || (resposta as any).error);
          return;
        }
        toast.success(t('admin.usuarios.toastUserCreated'));
      }


      await fetchUsuarios();
      setDialogOpen(false);
      form.reset();
      setEditingUsuario(null);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      toast.error(error.message || t('admin.usuarios.toastErrorSave'));
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    form.setValue('nome', usuario.nome);
    form.setValue('email', usuario.email);
    form.setValue('role', usuario.role as any);
    form.setValue('empresa_id', usuario.empresa_id || '');
    form.setValue('permission_profile_id', usuario.permission_profile_id || '');
    setDialogOpen(true);
  };

  const handleManagePermissions = (userId?: string) => {
    setSelectedUserForPermissions(userId);
    setShowPermissionMatrix(true);
  };

  const handleRestoreAllPermissions = async () => {
    try {
      setRestoringPermissions(true);
      
      const { data, error } = await supabase.functions.invoke('apply-default-permissions-all-users');
      
      if (error) throw error;
      
      toast.success(t('admin.usuarios.toastPermissionsRestored', { count: data?.successful || 0 }));
      await fetchUsuarios();
    } catch (error: any) {
      console.error('Erro ao restaurar permissões:', error);
      toast.error(error.message || t('admin.usuarios.toastErrorRestorePermissions'));
    } finally {
      setRestoringPermissions(false);
    }
  };

  const openDeleteDialog = (usuario: Usuario) => {
    setUsuarioToDelete(usuario);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!usuarioToDelete) return;
    
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-user-complete', {
        body: {
          user_id: usuarioToDelete.user_id,
          profile_id: usuarioToDelete.id
        }
      });

      if (deleteError) {
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', usuarioToDelete.id);

        if (profileDeleteError) throw profileDeleteError;
        toast.success(t('admin.usuarios.toastUserRemoved'));
      } else {
        toast.success(t('admin.usuarios.toastUserDeletedFully'));
      }
      
      await fetchUsuarios();
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(error.message || t('admin.usuarios.toastErrorDelete'));
    }
  };

  const shouldShowResendButton = (usuario: Usuario) => {
    const accessInfo = usersAccessInfo.get(usuario.user_id);
    return accessInfo?.first_access_pending || false;
  };

  const resendWelcomeEmail = async (usuario: Usuario) => {
    try {
      setActionLoading(prev => ({ ...prev, [`resend-${usuario.id}`]: true }));
      
      const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { userId: usuario.user_id }
      });

      if (error) throw error;

      const link = (data as any)?.setupPasswordUrl;
      if (link) {
        try { await navigator.clipboard.writeText(link); } catch {}
        toast.success(t('admin.usuarios.toastInviteResent', { nome: usuario.nome }));
      } else {
        toast.success(t('admin.usuarios.toastInviteResentSimple', { nome: usuario.nome }));
      }

      const userIds = usuarios.map(u => u.user_id);
      await fetchUsersAccessInfo(userIds);
      await fetchUsuarios();
    } catch (error: any) {
      console.error('Erro ao reenviar convite:', error);
      toast.error(error.message || t('admin.usuarios.toastErrorResendInvite'));
    } finally {
      setActionLoading(prev => ({ ...prev, [`resend-${usuario.id}`]: false }));
    }
  };

  const resetPassword = async (usuario: Usuario) => {
    try {
      setActionLoading(prev => ({ ...prev, [`reset-${usuario.id}`]: true }));
      
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { userId: usuario.user_id }
      });

      if (error) throw error;

      toast.success(t('admin.usuarios.toastPasswordReset', { email: usuario.email }));
      
      const userIds = usuarios.map(u => u.user_id);
      await fetchUsersAccessInfo(userIds);
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      toast.error(error.message || t('admin.usuarios.toastErrorResetPassword'));
    } finally {
      setActionLoading(prev => ({ ...prev, [`reset-${usuario.id}`]: false }));
    }
  };

  const getRoleBadge = (role: string) => {
    const variants = {
      super_admin: 'default',
      admin: 'secondary',
      user: 'outline',
      readonly: 'destructive'
    } as const;

    const labels = {
      super_admin: t('admin.usuarios.roleSuperAdmin'),
      admin: t('admin.usuarios.roleAdmin'),
      user: t('admin.usuarios.roleUser'),
      readonly: t('admin.usuarios.roleReadonly')
    } as const;

    return (
      <Badge variant={variants[role as keyof typeof variants] || 'outline'}>
        {labels[role as keyof typeof labels] || role}
      </Badge>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (showPermissionMatrix) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">{t('admin.usuarios.managePermissionsTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('admin.usuarios.managePermissionsDesc')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowPermissionMatrix(false)}
          >
            {t('admin.usuarios.back')}
          </Button>
        </div>
        <PermissionMatrix selectedUserId={selectedUserForPermissions} />
      </div>
    );
  }

  const columns: Column<Usuario>[] = [
    {
      key: 'nome',
      label: t('admin.usuarios.columnUsuario'),
      sortable: true,
      render: (_, usuario) => (
        <div className="flex items-center space-x-3">
          {usuario.foto_url ? (
            <img 
              src={usuario.foto_url} 
              alt={usuario.nome}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          <div>
            <div className="font-medium">{usuario.nome}</div>
            <div className="text-sm text-muted-foreground">{usuario.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('admin.usuarios.columnPapel'),
      sortable: true,
      render: (value) => getRoleBadge(value),
    },
    {
      key: 'permission_profile_id',
      label: t('admin.usuarios.columnPerfilPermissao'),
      sortable: false,
      render: (_, usuario) => {
        const profileName = usuario.permission_profiles?.name;
        return profileName ? (
          <Badge variant="outline" className="whitespace-nowrap">
            <Shield className="h-3 w-3 mr-1" />
            {profileName}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{t('admin.usuarios.semPerfil')}</span>
        );
      },
    },
    ...(isSuperAdmin ? [{
      key: 'empresa',
      label: t('admin.usuarios.columnEmpresa'),
      sortable: false,
      render: (_, usuario) => usuario.empresas?.nome || '-',
    } as Column<Usuario>] : []),
    {
      key: 'ativo',
      label: t('admin.usuarios.columnStatus'),
      sortable: true,
      render: (value) => (
        <Chip family="state" tone={value ? 'active' : 'rest'}>
          {value ? t('admin.usuarios.ativo') : t('admin.usuarios.inativo')}
        </Chip>
      ),
    },
    {
      key: 'acesso',
      label: t('admin.usuarios.columnAcesso'),
      sortable: false,
      render: (_, usuario) => {
        const accessInfo = usersAccessInfo.get(usuario.user_id);
        
        if (accessInfo?.last_sign_in_at) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-green-600">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-sm">{formatDateTime(accessInfo.last_sign_in_at)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {t('admin.usuarios.ultimoAcesso', { data: format(new Date(accessInfo.last_sign_in_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        if (accessInfo?.first_access_pending) {
          return (
            <Badge variant="warning" className="whitespace-nowrap">
              <Clock className="h-3 w-3 mr-1" />
              {t('admin.usuarios.primeiroAcessoPendente')}
            </Badge>
          );
        }
        
        return (
          <Badge variant="secondary">{t('admin.usuarios.nuncaAcessou')}</Badge>
        );
      },
    },
    {
      key: 'created_at',
      label: t('admin.usuarios.columnCriadoEm'),
      sortable: true,
      render: (value) => formatDateOnly(value),
    },
    {
      key: 'actions',
      label: t('admin.usuarios.columnAcoes'),
      className: 'w-24 text-right',
      render: (_, usuario) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(usuario)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('admin.usuarios.actionEditar')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleManagePermissions(usuario.user_id)}>
              <Shield className="h-4 w-4 mr-2" />
              {t('admin.usuarios.actionGerenciarPermissoes')}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => resetPassword(usuario)}
              disabled={actionLoading[`reset-${usuario.id}`]}
            >
              {actionLoading[`reset-${usuario.id}`] ? (
                <AkurisPulse size={16} className="mr-2" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {t('admin.usuarios.actionResetarSenha')}
            </DropdownMenuItem>
            {shouldShowResendButton(usuario) && (
              <DropdownMenuItem 
                onClick={() => resendWelcomeEmail(usuario)}
                disabled={actionLoading[`resend-${usuario.id}`]}
              >
                {actionLoading[`resend-${usuario.id}`] ? (
                  <AkurisPulse size={16} className="mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {t('admin.usuarios.actionReenviarConvite')}
              </DropdownMenuItem>
            )}
            {shouldShowResendButton(usuario) && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const { data: link, error } = await supabase
                      .rpc('get_user_invitation_link', { _user_id: usuario.user_id });
                    if (error || !link) {
                      toast.error(t('admin.usuarios.toastInviteLinkUnavailable'));
                      return;
                    }
                    await navigator.clipboard.writeText(link as string);
                    toast.success(t('admin.usuarios.toastInviteLinkCopied'));
                  } catch {
                    toast.error(t('admin.usuarios.toastErrorCopyLink'));
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t('admin.usuarios.actionCopiarLinkConvite')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => openDeleteDialog(usuario)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('admin.usuarios.actionExcluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters: Filter[] = [
    ...(isSuperAdmin ? [{
      key: 'empresa',
      label: t('admin.usuarios.filterEmpresaLabel'),
      options: [
        { value: 'all', label: t('admin.usuarios.filterEmpresaAll') },
        ...empresas.map(e => ({ value: e.id, label: e.nome }))
      ],
      value: filterEmpresa,
      onChange: setFilterEmpresa,
    }] : []),
    {
      key: 'role',
      label: t('admin.usuarios.filterPapelLabel'),
      options: [
        { value: 'all', label: t('admin.usuarios.filterPapelAll') },
        { value: 'super_admin', label: t('admin.usuarios.roleSuperAdmin') },
        { value: 'admin', label: t('admin.usuarios.roleAdministrador') },
        { value: 'user', label: t('admin.usuarios.roleUser') },
        { value: 'readonly', label: t('admin.usuarios.roleReadonly') },
      ],
      value: filterRole,
      onChange: setFilterRole,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title={t('admin.usuarios.statTotalTitle')}
          value={stats.total}
          icon={<Users className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          title={t('admin.usuarios.statActiveTitle')}
          value={stats.active}
          icon={<UserCheck className="h-5 w-5" />}
          variant="default"
          description={t('admin.usuarios.statActiveDesc')}
        />
        <StatCard
          title={t('admin.usuarios.statPendingTitle')}
          value={stats.pending}
          icon={<Clock className="h-5 w-5" />}
          variant={stats.pending > 0 ? 'warning' : 'default'}
          description={t('admin.usuarios.statPendingDesc')}
        />
        <StatCard
          title={t('admin.usuarios.statAdminsTitle')}
          value={stats.admins}
          icon={<ShieldCheck className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={handleRestoreAllPermissions}
                disabled={restoringPermissions}
              >
                {restoringPermissions ? (
                  <AkurisPulse size={16} className="mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                {t('admin.usuarios.restorePermissionsButton')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('admin.usuarios.restorePermissionsTooltip')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Button variant="outline" onClick={() => handleManagePermissions()}>
          <Shield className="h-4 w-4 mr-2" />
          {t('admin.usuarios.managePermissionsButton')}
        </Button>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('admin.usuarios.newUserButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? t('admin.usuarios.dialogEditTitle') : t('admin.usuarios.dialogNewTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.usuarios.fieldNome')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.usuarios.fieldEmail')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" disabled={!!editingUsuario} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.usuarios.fieldPapel')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.usuarios.fieldPapelPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isSuperAdmin && (
                            <SelectItem value="super_admin">{t('admin.usuarios.roleSuperAdmin')}</SelectItem>
                          )}
                          <SelectItem value="admin">{t('admin.usuarios.roleAdministrador')}</SelectItem>
                          <SelectItem value="user">{t('admin.usuarios.roleUser')}</SelectItem>
                          <SelectItem value="readonly">{t('admin.usuarios.roleReadonly')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permission_profile_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.usuarios.fieldPerfilPermissao')}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.usuarios.fieldPerfilPermissaoPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('admin.usuarios.semPerfil')}</SelectItem>
                          {permissionProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {isSuperAdmin && (
                  <FormField
                    control={form.control}
                    name="empresa_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.usuarios.fieldEmpresa')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('admin.usuarios.fieldEmpresaPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('admin.usuarios.nenhumaEmpresa')}</SelectItem>
                            {empresas.map((empresa) => (
                              <SelectItem key={empresa.id} value={empresa.id}>
                                {empresa.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t('admin.usuarios.cancelar')}
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <AkurisPulse size={16} className="mr-2" />
                    ) : null}
                    {editingUsuario ? t('admin.usuarios.atualizar') : t('admin.usuarios.criar')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredUsuarios}
        columns={columns}
        loading={loading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.usuarios.searchPlaceholder')}
        filters={filters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={fetchUsuarios}
        paginated
        emptyState={{
          icon: <Users className="h-12 w-12" />,
          title: t('admin.usuarios.emptyTitle'),
          description: searchTerm ? t('admin.usuarios.emptyDescriptionFiltered') : t('admin.usuarios.emptyDescriptionEmpty'),
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('admin.usuarios.deleteDialogTitle')}
        description={t('admin.usuarios.deleteDialogDescription', { nome: usuarioToDelete?.nome || '' })}
        confirmText={t('admin.usuarios.excluir')}
        cancelText={t('admin.usuarios.cancelar')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default GerenciamentoUsuariosEnhanced;
