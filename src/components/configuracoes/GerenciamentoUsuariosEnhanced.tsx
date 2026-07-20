import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
const usuarioSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  role: z.enum(['super_admin', 'admin', 'user', 'readonly']),
  empresa_id: z.string().optional(),
  permission_profile_id: z.string().optional(),
});

type UsuarioForm = z.infer<typeof usuarioSchema>;

interface PermissionProfile {
  id: string;
  name: string;
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
      toast.error('Erro ao carregar usuários');
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

  const fetchPermissionProfiles = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) return;

      const { data, error } = await supabase
        .from('permission_profiles')
        .select('id, name')
        .eq('empresa_id', profile.empresa_id)
        .order('name');

      if (error) throw error;
      setPermissionProfiles(data || []);
    } catch (error) {
      console.error('Erro ao buscar perfis de permissão:', error);
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

        toast.success('Usuário atualizado com sucesso');
      } else {
        const { error } = await supabase.functions.invoke('create-user', {
          body: {
            email: data.email,
            nome: data.nome,
            role: data.role,
            empresa_id: data.empresa_id || null,
            permission_profile_id: data.permission_profile_id || null,
          }
        });

        if (error) {
          if (error.message?.includes('DUPLICATE_USER')) {
            toast.error(`Usuário já existe: ${data.email}`);
            return;
          }
          throw error;
        }
        toast.success('Usuário criado com sucesso');
      }

      await fetchUsuarios();
      setDialogOpen(false);
      form.reset();
      setEditingUsuario(null);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      toast.error(error.message || 'Erro ao salvar usuário');
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
      
      toast.success(`Permissões restauradas para ${data?.successful || 0} usuários`);
      await fetchUsuarios();
    } catch (error: any) {
      console.error('Erro ao restaurar permissões:', error);
      toast.error(error.message || "Erro ao restaurar permissões");
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
        toast.success('Usuário removido do sistema');
      } else {
        toast.success('Usuário excluído completamente');
      }
      
      await fetchUsuarios();
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
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
        toast.success(`Convite reenviado para ${usuario.nome}. Link copiado para área de transferência.`);
      } else {
        toast.success(`Convite reenviado para ${usuario.nome}`);
      }

      const userIds = usuarios.map(u => u.user_id);
      await fetchUsersAccessInfo(userIds);
      await fetchUsuarios();
    } catch (error: any) {
      console.error('Erro ao reenviar convite:', error);
      toast.error(error.message || 'Erro ao reenviar convite');
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

      toast.success(`Nova senha temporária enviada para ${usuario.email}`);
      
      const userIds = usuarios.map(u => u.user_id);
      await fetchUsersAccessInfo(userIds);
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      toast.error(error.message || 'Erro ao resetar senha');
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
      super_admin: 'Super Admin',
      admin: 'Admin',
      user: 'Usuário',
      readonly: 'Somente Leitura'
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
            <h3 className="text-lg font-medium">Gerenciar Permissões</h3>
            <p className="text-sm text-muted-foreground">
              Configure permissões específicas por usuário e módulo
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowPermissionMatrix(false)}
          >
            Voltar
          </Button>
        </div>
        <PermissionMatrix selectedUserId={selectedUserForPermissions} />
      </div>
    );
  }

  const columns: Column<Usuario>[] = [
    {
      key: 'nome',
      label: 'Usuário',
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
      label: 'Papel',
      sortable: true,
      render: (value) => getRoleBadge(value),
    },
    {
      key: 'permission_profile_id',
      label: 'Perfil de Permissão',
      sortable: false,
      render: (_, usuario) => {
        const profileName = usuario.permission_profiles?.name;
        return profileName ? (
          <Badge variant="outline" className="whitespace-nowrap">
            <Shield className="h-3 w-3 mr-1" />
            {profileName}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Sem perfil</span>
        );
      },
    },
    ...(isSuperAdmin ? [{
      key: 'empresa',
      label: 'Empresa',
      sortable: false,
      render: (_, usuario) => usuario.empresas?.nome || '-',
    } as Column<Usuario>] : []),
    {
      key: 'ativo',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'acesso',
      label: 'Acesso',
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
                  Último acesso: {format(new Date(accessInfo.last_sign_in_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        if (accessInfo?.first_access_pending) {
          return (
            <Badge variant="warning" className="whitespace-nowrap">
              <Clock className="h-3 w-3 mr-1" />
              Primeiro acesso pendente
            </Badge>
          );
        }
        
        return (
          <Badge variant="secondary">Nunca acessou</Badge>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Criado em',
      sortable: true,
      render: (value) => formatDateOnly(value),
    },
    {
      key: 'actions',
      label: 'Ações',
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
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleManagePermissions(usuario.user_id)}>
              <Shield className="h-4 w-4 mr-2" />
              Gerenciar Permissões
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
              Resetar Senha
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
                Reenviar Convite
              </DropdownMenuItem>
            )}
            {shouldShowResendButton(usuario) && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const { data: link, error } = await supabase
                      .rpc('get_user_invitation_link', { _user_id: usuario.user_id });
                    if (error || !link) {
                      toast.error('Link de convite indisponível');
                      return;
                    }
                    await navigator.clipboard.writeText(link as string);
                    toast.success('Link de convite copiado');
                  } catch {
                    toast.error('Não foi possível copiar o link');
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link de Convite
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => openDeleteDialog(usuario)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters: Filter[] = [
    ...(isSuperAdmin ? [{
      key: 'empresa',
      label: 'Empresa',
      options: [
        { value: 'all', label: 'Todas as empresas' },
        ...empresas.map(e => ({ value: e.id, label: e.nome }))
      ],
      value: filterEmpresa,
      onChange: setFilterEmpresa,
    }] : []),
    {
      key: 'role',
      label: 'Papel',
      options: [
        { value: 'all', label: 'Todos os papéis' },
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'admin', label: 'Administrador' },
        { value: 'user', label: 'Usuário' },
        { value: 'readonly', label: 'Somente Leitura' },
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
          title="Total de Usuários"
          value={stats.total}
          icon={<Users className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          title="Usuários Ativos"
          value={stats.active}
          icon={<UserCheck className="h-5 w-5" />}
          variant="default"
          description="Com pelo menos um acesso"
        />
        <StatCard
          title="Pendentes"
          value={stats.pending}
          icon={<Clock className="h-5 w-5" />}
          variant={stats.pending > 0 ? 'warning' : 'default'}
          description="Primeiro acesso pendente"
        />
        <StatCard
          title="Administradores"
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
                Restaurar Permissões
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Aplica permissões padrão para todos os usuários
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Button variant="outline" onClick={() => handleManagePermissions()}>
          <Shield className="h-4 w-4 mr-2" />
          Gerenciar Permissões
        </Button>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Papel</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o papel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isSuperAdmin && (
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          )}
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="readonly">Somente Leitura</SelectItem>
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
                      <FormLabel>Perfil de Permissão</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o perfil de permissão" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sem perfil</SelectItem>
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
                        <FormLabel>Empresa</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma empresa</SelectItem>
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
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <AkurisPulse size={16} className="mr-2" />
                    ) : null}
                    {editingUsuario ? 'Atualizar' : 'Criar'}
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
        searchPlaceholder="Buscar por nome ou email..."
        filters={filters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={fetchUsuarios}
        paginated
        emptyState={{
          icon: <Users className="h-12 w-12" />,
          title: 'Nenhum usuário encontrado',
          description: searchTerm ? 'Tente ajustar os filtros' : 'Crie um novo usuário para começar',
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Usuário"
        description={`Tem certeza que deseja excluir o usuário "${usuarioToDelete?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default GerenciamentoUsuariosEnhanced;
