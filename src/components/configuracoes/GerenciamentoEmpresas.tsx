import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building2, Upload, MoreHorizontal, RefreshCw, Power, PowerOff } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PlanBadge } from '@/components/PlanBadge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DataTable, Column, Filter } from '@/components/ui/data-table';
import { formatDateOnly } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';

const makeEmpresaSchema = (t: (k: string) => string) => z.object({
  nome: z.string().min(1, t('admin.empresas.zodNomeRequired')),
  cnpj: z.string().optional(),
  contato: z.string().optional(),
  status_licenca: z.enum(['trial', 'em_operacao']).default('em_operacao'),
  plano_id: z.string().optional(),
});

type EmpresaForm = z.infer<ReturnType<typeof makeEmpresaSchema>>;

interface Plano {
  id: string;
  nome: string;
  codigo: string;
  creditos_franquia: number;
  descricao: string | null;
  icone: string;
  cor_primaria: string;
}

interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  contato?: string;
  logo_url?: string;
  ativo: boolean;
  status_licenca: 'trial' | 'em_operacao';
  data_inicio_trial?: string;
  plano_id?: string;
  creditos_consumidos?: number;
  created_at: string;
  plano?: {
    nome: string;
    codigo: string;
    creditos_franquia: number;
    icone: string;
    cor_primaria: string;
  };
}

const GerenciamentoEmpresasInner = () => {
  const { t } = useLanguage();
  const empresaSchema = useMemo(() => makeEmpresaSchema(t), [t]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [licencaFilter, setLicencaFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empresaToDelete, setEmpresaToDelete] = useState<Empresa | null>(null);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>('');
  const [sortField, setSortField] = useState<string>('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [renewTrialEmpresa, setRenewTrialEmpresa] = useState<Empresa | null>(null);

  // Provisionamento visual da criação de empresa (etapas reais)
  const [provisioningOpen, setProvisioningOpen] = useState(false);
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);

  const buildSteps = (): ProvisioningStep[] => [
    { id: 'registro', label: t('admin.empresas.provisioning.stepRegistro'), state: 'running' },
    { id: 'licenca', label: t('admin.empresas.provisioning.stepLicenca'), state: 'pending' },
    { id: 'banco', label: t('admin.empresas.provisioning.stepBanco'), state: 'pending' },
    { id: 'denuncia', label: t('admin.empresas.provisioning.stepDenuncia'), state: 'pending' },
    { id: 'finalizar', label: t('admin.empresas.provisioning.stepFinalizar'), state: 'pending' },
  ];

  const beginProvisioning = () => {
    setProvisioningSteps(buildSteps());
    setProvisioningOpen(true);
  };

  const setStepState = (id: string, state: ProvisioningStep['state']) =>
    setProvisioningSteps((prev) => prev.map((s) => (s.id === id ? { ...s, state } : s)));

  const completeStep = (id: string, next?: string) => {
    setProvisioningSteps((prev) =>
      prev.map((s) => {
        if (s.id === id) return { ...s, state: 'done' as const };
        if (next && s.id === next) return { ...s, state: 'running' as const };
        return s;
      }),
    );
  };

  const failStep = (id: string) => setStepState(id, 'error');
  const [toggleAtivoEmpresa, setToggleAtivoEmpresa] = useState<Empresa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const form = useForm<EmpresaForm>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: '',
      cnpj: '',
      contato: '',
      status_licenca: 'em_operacao',
      plano_id: '',
    },
  });

  const fetchPlanos = async () => {
    try {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('creditos_franquia');

      if (error) throw error;
      setPlanos(data || []);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select(`
          *,
          plano:planos (
            nome,
            codigo,
            creditos_franquia,
            icone,
            cor_primaria
          )
        `)
        .order('nome');

      if (error) throw error;
      
      const empresasFormatadas = (data || []).map(emp => ({
        ...emp,
        status_licenca: (emp.status_licenca || 'em_operacao') as 'trial' | 'em_operacao',
      }));
      
      setEmpresas(empresasFormatadas);
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
      toast.error(t('admin.empresas.toastErrorFetchEmpresas'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
    fetchPlanos();
  }, []);

  const filteredEmpresas = empresas.filter(empresa => {
    const matchesSearch = empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empresa.cnpj?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'ativo' && empresa.ativo) || 
      (statusFilter === 'inativo' && !empresa.ativo);
    const matchesLicenca = licencaFilter === 'all' || empresa.status_licenca === licencaFilter;
    return matchesSearch && matchesStatus && matchesLicenca;
  });

  const handleSubmit = async (data: EmpresaForm) => {
    try {
      if (editingEmpresa) {
        const updateData: any = {
          nome: data.nome,
          cnpj: data.cnpj,
          contato: data.contato,
          status_licenca: data.status_licenca,
          plano_id: data.plano_id || null,
        };

        if (data.status_licenca === 'trial' && !editingEmpresa.data_inicio_trial) {
          updateData.data_inicio_trial = new Date().toISOString();
        }

        const { error } = await supabase
          .from('empresas')
          .update(updateData)
          .eq('id', editingEmpresa.id);

        if (error) throw error;
        toast.success(t('admin.empresas.toastEmpresaUpdated'));
      } else {
        const insertData: any = {
          nome: data.nome,
          cnpj: data.cnpj,
          contato: data.contato,
          status_licenca: data.status_licenca,
          plano_id: data.plano_id || null,
        };

        if (data.status_licenca === 'trial') {
          insertData.data_inicio_trial = new Date().toISOString();
        }

        setDialogOpen(false);
        beginProvisioning();

        // 1) Registo da empresa
        const { data: created, error } = await supabase
          .from('empresas')
          .insert([insertData])
          .select('id, slug')
          .single();

        if (error) {
          failStep('registro');
          throw error;
        }
        completeStep('registro', 'licenca');

        // 2) Licença/plano já persistidos com o registo
        completeStep('licenca', 'banco');

        // 3) Estrutura de dados isolada (validação do tenant)
        await supabase.from('empresas').select('id').eq('id', created.id).maybeSingle();
        completeStep('banco', 'denuncia');

        // 4) Canal de denúncia público independente
        const { error: canalError } = await supabase.rpc('provisionar_canal_denuncia', {
          p_empresa_id: created.id,
        });
        if (canalError) {
          logger.error('Falha ao provisionar canal de denúncia', canalError);
          failStep('denuncia');
        } else {
          completeStep('denuncia', 'finalizar');
        }

        // 5) Conclusão
        completeStep('finalizar');
        await new Promise((r) => setTimeout(r, 500));
        setProvisioningOpen(false);
        toast.success(t('admin.empresas.toastEmpresaCreated'));
      }

      setDialogOpen(false);
      setEditingEmpresa(null);
      form.reset();
      fetchEmpresas();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      toast.error(t('admin.empresas.toastErrorSave'));
    }
  };

  const handleEdit = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setSelectedPlanoId(empresa.plano_id || '');
    form.reset({
      nome: empresa.nome,
      cnpj: empresa.cnpj || '',
      contato: empresa.contato || '',
      status_licenca: empresa.status_licenca || 'em_operacao',
      plano_id: empresa.plano_id || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (empresa: Empresa) => {
    setEmpresaToDelete(empresa);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!empresaToDelete) return;
    
    try {
      const confirmName = window.prompt(
        t('admin.empresas.deletePrompt', { nome: empresaToDelete.nome })
      );
      if (!confirmName) return;

      const { data, error } = await supabase.functions.invoke('delete-empresa-safe', {
        body: { empresa_id: empresaToDelete.id, confirm_name: confirmName },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

      toast.success(t('admin.empresas.toastEmpresaDeleted', { count: (data as any)?.deleted_users || 0 }));
      fetchEmpresas();
      setDeleteDialogOpen(false);
      setEmpresaToDelete(null);
    } catch (error: any) {
      console.error('Erro ao excluir empresa:', error);
      toast.error(error?.message || t('admin.empresas.toastErrorDelete'));
    }
  };

  const handleLogoUpload = async (empresaId: string, file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${empresaId}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('empresa-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('empresa-logos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', empresaId);

      if (updateError) throw updateError;

      toast.success(t('admin.empresas.toastLogoUpdated'));
      fetchEmpresas();
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      toast.error(t('admin.empresas.toastErrorLogoUpload'));
    } finally {
      setUploading(false);
    }
  };

  const confirmRenovarTrial = async () => {
    if (!renewTrialEmpresa) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('empresas')
        .update({
          status_licenca: 'trial',
          data_inicio_trial: new Date().toISOString(),
          ativo: true,
        })
        .eq('id', renewTrialEmpresa.id);
      if (error) throw error;
      toast.success(t('admin.empresas.toastTrialRenewed', { nome: renewTrialEmpresa.nome }));
      setRenewTrialEmpresa(null);
      fetchEmpresas();
    } catch (error: any) {
      console.error('Erro ao renovar trial:', error);
      toast.error(error?.message || t('admin.empresas.toastErrorRenewTrial'));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmToggleAtivo = async () => {
    if (!toggleAtivoEmpresa) return;
    const novoStatus = !toggleAtivoEmpresa.ativo;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('empresas')
        .update({ ativo: novoStatus })
        .eq('id', toggleAtivoEmpresa.id);
      if (error) throw error;
      toast.success(t('admin.empresas.toastStatusChanged', { nome: toggleAtivoEmpresa.nome, status: novoStatus ? t('admin.empresas.statusAtivada') : t('admin.empresas.statusInativada') }));
      setToggleAtivoEmpresa(null);
      fetchEmpresas();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast.error(error?.message || t('admin.empresas.toastErrorToggleStatus'));
    } finally {
      setActionLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingEmpresa(null);
    setSelectedPlanoId('');
    form.reset();
    setDialogOpen(true);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const selectedPlano = planos.find(p => p.id === selectedPlanoId);
  const creditoConsumido = editingEmpresa?.creditos_consumidos || 0;
  const creditoFranquia = selectedPlano?.creditos_franquia || editingEmpresa?.plano?.creditos_franquia || 0;
  const percentualCredito = creditoFranquia > 0 ? (creditoConsumido / creditoFranquia) * 100 : 0;

  const columns: Column<Empresa>[] = [
    {
      key: 'logo_url',
      label: t('admin.empresas.columnLogo'),
      sortable: false,
      render: (_, empresa) => (
        <div className="flex items-center">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={empresa.nome}
              className="h-8 w-8 object-contain rounded"
            />
          ) : (
            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'nome',
      label: t('admin.empresas.columnNome'),
      sortable: true,
    },
    {
      key: 'cnpj',
      label: t('admin.empresas.columnCnpj'),
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'contato',
      label: t('admin.empresas.columnContato'),
      sortable: false,
      render: (value) => value || '-',
    },
    {
      key: 'plano',
      label: t('admin.empresas.columnPlano'),
      sortable: false,
      render: (_, empresa) => empresa.plano ? (
        <PlanBadge 
          planCode={empresa.plano.codigo as any}
          planName={empresa.plano.nome}
          size="sm"
          showName={false}
        />
      ) : (
        <span className="text-xs text-muted-foreground">{t('admin.empresas.semPlano')}</span>
      ),
    },
    {
      key: 'status_licenca',
      label: t('admin.empresas.columnLicenca'),
      sortable: true,
      render: (value, empresa) => value === 'trial' ? (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning whitespace-nowrap">
          🟡 {empresa.data_inicio_trial
            ? t('admin.empresas.trialDays', { dias: Math.max(0, 14 - differenceInDays(new Date(), new Date(empresa.data_inicio_trial))) })
            : t('admin.empresas.filterLicencaTrial')
          }
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary whitespace-nowrap">
          🟢 {t('admin.empresas.emOperacao')}
        </Badge>
      ),
    },
    {
      key: 'ativo',
      label: t('admin.empresas.columnStatus'),
      sortable: true,
      render: (value) => (
        <Chip family="state" tone={value ? 'active' : 'rest'}>
          {value ? t('admin.empresas.ativo') : t('admin.empresas.inativo')}
        </Chip>
      ),
    },
    {
      key: 'created_at',
      label: t('admin.empresas.columnCriadoEm'),
      sortable: true,
      render: (value) => formatDateOnly(value),
    },
    {
      key: 'actions',
      label: t('admin.empresas.columnAcoes'),
      className: 'w-16 text-right',
      render: (_, empresa) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(empresa)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('admin.empresas.actionEditar')}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <label className="flex items-center gap-2 cursor-pointer">
                <Upload className="h-4 w-4" />
                {t('admin.empresas.actionUploadLogo')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(empresa.id, file);
                  }}
                  disabled={uploading}
                />
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToggleAtivoEmpresa(empresa)}>
              {empresa.ativo ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  {t('admin.empresas.actionInativarEmpresa')}
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  {t('admin.empresas.actionAtivarEmpresa')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenewTrialEmpresa(empresa)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('admin.empresas.actionRenovarTrial')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openDeleteDialog(empresa)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('admin.empresas.actionExcluir')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters: Filter[] = [
    {
      key: 'status',
      label: t('admin.empresas.filterStatusLabel'),
      options: [
        { value: 'all', label: t('admin.empresas.filterStatusAll') },
        { value: 'ativo', label: t('admin.empresas.filterStatusAtivos') },
        { value: 'inativo', label: t('admin.empresas.filterStatusInativos') },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
    },
    {
      key: 'licenca',
      label: t('admin.empresas.filterLicencaLabel'),
      options: [
        { value: 'all', label: t('admin.empresas.filterLicencaAll') },
        { value: 'trial', label: t('admin.empresas.filterLicencaTrial') },
        { value: 'em_operacao', label: t('admin.empresas.filterLicencaEmOperacao') },
      ],
      value: licencaFilter,
      onChange: setLicencaFilter,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('admin.empresas.newEmpresaButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmpresa ? t('admin.empresas.dialogEditTitle') : t('admin.empresas.dialogNewTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.empresas.fieldNome')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.empresas.fieldNomePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.empresas.fieldCnpj')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.empresas.fieldCnpjPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.empresas.fieldContato')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.empresas.fieldContatoPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status_licenca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.empresas.fieldStatusLicenca')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.empresas.fieldStatusLicencaPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="em_operacao">{t('admin.empresas.statusEmOperacao')}</SelectItem>
                          <SelectItem value="trial">{t('admin.empresas.statusTrial')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-6" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('admin.empresas.planoSectionTitle')}</h3>
                  
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                    {editingEmpresa?.plano && (
                      <div className="flex items-center gap-3">
                        <PlanBadge 
                          planCode={editingEmpresa.plano.codigo as any}
                          planName={editingEmpresa.plano.nome}
                          size="md"
                        />
                      </div>
                    )}

                    {editingEmpresa && creditoFranquia > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('admin.empresas.consumoCreditos')}</span>
                          <span className="font-medium">
                            {creditoConsumido} / {creditoFranquia} ({Math.round(percentualCredito)}%)
                          </span>
                        </div>
                        <Progress value={percentualCredito} className="h-2" />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="plano_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('admin.empresas.fieldPlano')}</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedPlanoId(value);
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('admin.empresas.fieldPlanoPlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {planos.map((plano) => (
                                <SelectItem key={plano.id} value={plano.id}>
                                  {plano.nome} ({plano.creditos_franquia} {t('admin.empresas.creditosSuffix')})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedPlano && (
                      <div className="text-sm text-muted-foreground bg-background p-3 rounded border">
                        ℹ️ {selectedPlano.descricao || t('admin.empresas.semDescricao')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    {t('admin.empresas.cancelar')}
                  </Button>
                  <Button type="submit">
                    {editingEmpresa ? t('admin.empresas.atualizar') : t('admin.empresas.criar')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={filteredEmpresas}
        columns={columns}
        loading={loading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.empresas.searchPlaceholder')}
        filters={filters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRefresh={fetchEmpresas}
        paginated
        emptyState={{
          icon: <Building2 className="h-12 w-12" />,
          title: t('admin.empresas.emptyTitle'),
          description: searchTerm ? t('admin.empresas.emptyDescriptionFiltered') : t('admin.empresas.emptyDescriptionEmpty'),
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('admin.empresas.deleteDialogTitle')}
        description={t('admin.empresas.deleteDialogDescription', { nome: empresaToDelete?.nome || '' })}
        onConfirm={handleDelete}
        variant="destructive"
        confirmText={t('admin.empresas.excluir')}
      />

      <ConfirmDialog
        open={!!renewTrialEmpresa}
        onOpenChange={(open) => !open && setRenewTrialEmpresa(null)}
        title={t('admin.empresas.renewTrialTitle')}
        description={t('admin.empresas.renewTrialDescription', { nome: renewTrialEmpresa?.nome || '' })}
        onConfirm={confirmRenovarTrial}
        confirmText={t('admin.empresas.renovar')}
        loading={actionLoading}
      />

      <ConfirmDialog
        open={!!toggleAtivoEmpresa}
        onOpenChange={(open) => !open && setToggleAtivoEmpresa(null)}
        title={toggleAtivoEmpresa?.ativo ? t('admin.empresas.toggleAtivoTitleInativar') : t('admin.empresas.toggleAtivoTitleAtivar')}
        description={
          toggleAtivoEmpresa?.ativo
            ? t('admin.empresas.toggleAtivoDescInativar', { nome: toggleAtivoEmpresa?.nome || '' })
            : t('admin.empresas.toggleAtivoDescAtivar', { nome: toggleAtivoEmpresa?.nome || '' })
        }
        onConfirm={confirmToggleAtivo}
        variant={toggleAtivoEmpresa?.ativo ? 'destructive' : 'default'}
        confirmText={toggleAtivoEmpresa?.ativo ? t('admin.empresas.inativar') : t('admin.empresas.ativar')}
        loading={actionLoading}
      />
    </div>
  );
};

const GerenciamentoEmpresas = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const isSuperAdmin = profile?.role === 'super_admin';

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">{t('admin.empresas.accessRestrictedTitle')}</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-2">
          {t('admin.empresas.accessRestrictedDescription')}
        </p>
      </div>
    );
  }

  return <GerenciamentoEmpresasInner />;
};

export default GerenciamentoEmpresas;
