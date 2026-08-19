import { useState, useEffect } from 'react';
import { IconAdd, IconInfo, IconCalendar, IconCalendarClock, IconMoney, IconPerson } from '@/components/icons';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveMarcoStatusTone, resolveMarcoTipoTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

interface Contrato {
  id: string;
  nome: string;
  numero_contrato: string;
}

interface Marco {
  id: string;
  nome: string;
  tipo: string;
  data_prevista: string;
  data_realizada: string | null;
  status: string;
  responsavel: string | null;
  descricao: string;
  valor: number | null;
  alerta_antecedencia: number;
  observacoes: string;
}

interface MarcosDialogProps {
  contrato: Contrato | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarcosDialog({ contrato, open, onOpenChange }: MarcosDialogProps) {
  const [marcos, setMarcos] = useState<Marco[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMarco, setEditingMarco] = useState<Marco | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome?: string }>({ open: false, id: '' });
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'vencimento',
    data_prevista: '',
    data_realizada: '',
    status: 'pendente',
    responsavel: '',
    descricao: '',
    valor: '',
    alerta_antecedencia: '30',
    observacoes: ''
  });
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (open && contrato) {
      fetchMarcos();
      fetchUsuarios();
    }
  }, [open, contrato]);

  const fetchMarcos = async () => {
    if (!contrato) return;

    try {
      const { data, error } = await supabase
        .from('contrato_marcos')
        .select('*')
        .eq('contrato_id', contrato.id)
        .order('data_prevista');

      if (error) throw error;
      setMarcos(data || []);
    } catch (error) {
      console.error('Erro ao carregar marcos:', error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.empresa_id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nome')
        .eq('ativo', true)
        .eq('empresa_id', profile.empresa_id)
        .order('nome');

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.data_prevista || !contrato) {
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.marcosDialog.toastFillRequired'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const marcoData = {
        contrato_id: contrato.id,
        nome: formData.nome,
        tipo: formData.tipo,
        data_prevista: formData.data_prevista,
        data_realizada: formData.data_realizada || null,
        status: formData.status,
        responsavel: formData.responsavel || null,
        descricao: formData.descricao,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        alerta_antecedencia: parseInt(formData.alerta_antecedencia),
        observacoes: formData.observacoes
      };

      let error;
      
      if (editingMarco) {
        const { error: updateError } = await supabase
          .from('contrato_marcos')
          .update(marcoData)
          .eq('id', editingMarco.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('contrato_marcos')
          .insert([marcoData]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: t('contratosAtivos.common.success'),
        description: t('contratosAtivos.marcosDialog.toastSaveSuccess').replace('{action}', editingMarco ? t('contratosAtivos.marcosDialog.actionUpdated') : t('contratosAtivos.marcosDialog.actionCreated')),
      });

      resetForm();
      fetchMarcos();
    } catch (error) {
      console.error('Erro ao salvar marco:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.marcosDialog.toastSaveError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (marco: Marco) => {
    setEditingMarco(marco);
    setFormData({
      nome: marco.nome,
      tipo: marco.tipo,
      data_prevista: marco.data_prevista,
      data_realizada: marco.data_realizada || '',
      status: marco.status,
      responsavel: marco.responsavel || '',
      descricao: marco.descricao,
      valor: marco.valor?.toString() || '',
      alerta_antecedencia: marco.alerta_antecedencia.toString(),
      observacoes: marco.observacoes
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('contrato_marcos')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: t('contratosAtivos.common.success'),
        description: t('contratosAtivos.marcosDialog.toastDeleteSuccess'),
      });

      fetchMarcos();
    } catch (error) {
      console.error('Erro ao excluir marco:', error);
      toast({
        title: t('contratosAtivos.common.error'),
        description: t('contratosAtivos.marcosDialog.toastDeleteError'),
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ open: false, id: '' });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'vencimento',
      data_prevista: '',
      data_realizada: '',
      status: 'pendente',
      responsavel: '',
      descricao: '',
      valor: '',
      alerta_antecedencia: '30',
      observacoes: ''
    });
    setEditingMarco(null);
    setShowForm(false);
  };

  // status e tipo agora resolvidos via StatusBadge + resolvers

  const isOverdue = (dataPrevista: string, status: string) => {
    if (status === 'concluido' || status === 'cancelado') return false;
    return new Date(dataPrevista) < new Date();
  };

  if (!contrato) return null;

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconCalendarClock}
      title={t('contratosAtivos.marcosDialog.title').replace('{nome}', contrato.nome)}
      description={t('contratosAtivos.marcosDialog.description').replace('{numero}', contrato.numero_contrato)}
      size="lg"
      hideFooter
    >
        <div className="space-y-4">
          {!showForm && (
            <div className="flex justify-end items-center">
              <Button onClick={() => setShowForm(true)}>
                <IconAdd className="h-4 w-4 mr-2" />
                {t('contratosAtivos.marcosDialog.newButton')}
              </Button>
            </div>
          )}

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingMarco ? t('contratosAtivos.marcosDialog.cardTitleEdit') : t('contratosAtivos.marcosDialog.cardTitleNew')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">{t('contratosAtivos.marcosDialog.labelName')}</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder={t('contratosAtivos.marcosDialog.namePlaceholder')}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo">{t('contratosAtivos.marcosDialog.labelType')}</Label>
                      <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vencimento">{t('contratosAtivos.marcosDialog.typeVencimento')}</SelectItem>
                          <SelectItem value="renovacao">{t('contratosAtivos.marcosDialog.typeRenovacao')}</SelectItem>
                          <SelectItem value="pagamento">{t('contratosAtivos.marcosDialog.typePagamento')}</SelectItem>
                          <SelectItem value="entrega">{t('contratosAtivos.marcosDialog.typeEntrega')}</SelectItem>
                          <SelectItem value="revisao">{t('contratosAtivos.marcosDialog.typeRevisao')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_prevista">{t('contratosAtivos.marcosDialog.labelExpectedDate')}</Label>
                      <Input
                        id="data_prevista"
                        type="date"
                        value={formData.data_prevista}
                        onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_realizada">{t('contratosAtivos.marcosDialog.labelActualDate')}</Label>
                      <Input
                        id="data_realizada"
                        type="date"
                        value={formData.data_realizada}
                        onChange={(e) => setFormData({ ...formData, data_realizada: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">{t('contratosAtivos.marcosDialog.labelStatus')}</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">{t('contratosAtivos.marcosDialog.statusPendente')}</SelectItem>
                          <SelectItem value="concluido">{t('contratosAtivos.marcosDialog.statusConcluido')}</SelectItem>
                          <SelectItem value="atrasado">{t('contratosAtivos.marcosDialog.statusAtrasado')}</SelectItem>
                          <SelectItem value="cancelado">{t('contratosAtivos.marcosDialog.statusCancelado')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="responsavel">{t('contratosAtivos.marcosDialog.labelResponsible')}</Label>
                      <Select value={formData.responsavel} onValueChange={(value) => setFormData({ ...formData, responsavel: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('contratosAtivos.marcosDialog.responsiblePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {usuarios.map((usuario) => (
                            <SelectItem key={usuario.user_id} value={usuario.user_id}>
                              {usuario.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="valor">{t('contratosAtivos.marcosDialog.labelValue')}</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alerta_antecedencia">{t('contratosAtivos.marcosDialog.labelAlertDays')}</Label>
                      <Input
                        id="alerta_antecedencia"
                        type="number"
                        value={formData.alerta_antecedencia}
                        onChange={(e) => setFormData({ ...formData, alerta_antecedencia: e.target.value })}
                        placeholder="30"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="descricao">{t('contratosAtivos.marcosDialog.labelDescription')}</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder={t('contratosAtivos.marcosDialog.descriptionPlaceholder')}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="observacoes">{t('contratosAtivos.marcosDialog.labelObservations')}</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder={t('contratosAtivos.marcosDialog.observationsPlaceholder')}
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t('contratosAtivos.marcosDialog.cancelButton')}
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? t('contratosAtivos.marcosDialog.savingButton') : (editingMarco ? t('contratosAtivos.marcosDialog.submitUpdate') : t('contratosAtivos.marcosDialog.submitCreate'))}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {marcos.map((marco) => (
              <Card key={marco.id} className={`hover:shadow-sm transition-shadow ${isOverdue(marco.data_prevista, marco.status) ? 'border-destructive/30' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{marco.nome}</h3>
                        {isOverdue(marco.data_prevista, marco.status) && (
                          <IconInfo className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{marco.descricao}</p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge {...resolveMarcoTipoTone(marco.tipo)}>{formatStatus(marco.tipo)}</StatusBadge>
                      <StatusBadge {...resolveMarcoStatusTone(marco.status)}>{formatStatus(marco.status)}</StatusBadge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{t('contratosAtivos.marcosDialog.fieldExpectedDate')}</span>
                        <p>{formatDateOnly(marco.data_prevista)}</p>
                      </div>
                    </div>

                    {marco.data_realizada && (
                      <div className="flex items-center gap-2">
                        <IconCalendar className="h-4 w-4 text-success" />
                        <div>
                          <span className="font-medium">{t('contratosAtivos.marcosDialog.fieldActualDate')}</span>
                          <p>{formatDateOnly(marco.data_realizada)}</p>
                        </div>
                      </div>
                    )}

                    {marco.valor && (
                      <div className="flex items-center gap-2">
                        <IconMoney className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{t('contratosAtivos.marcosDialog.fieldValue')}</span>
                          <p>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(marco.valor))}</p>
                        </div>
                      </div>
                    )}

                    {marco.responsavel && (
                      <div className="flex items-center gap-2">
                        <IconPerson className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{t('contratosAtivos.marcosDialog.fieldResponsible')}</span>
                          <p>{usuarios.find(u => u.user_id === marco.responsavel)?.nome || t('contratosAtivos.marcosDialog.naFallback')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {marco.observacoes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">{marco.observacoes}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(marco)}>
                      {t('contratosAtivos.marcosDialog.editButton')}
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ open: true, id: marco.id, nome: marco.nome })}>
                      {t('contratosAtivos.marcosDialog.deleteButton')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {marcos.length === 0 && !showForm && (
            <Card>
              <CardContent className="text-center py-8">
                <IconCalendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t('contratosAtivos.marcosDialog.emptyState')}</p>
              </CardContent>
            </Card>
          )}
        </div>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
      title={t('contratosAtivos.marcosDialog.deleteDialogTitle')}
      description={t('contratosAtivos.marcosDialog.deleteDialogDescription').replace('{nome}', deleteConfirm.nome || '')}
      confirmText={t('contratosAtivos.marcosDialog.deleteDialogConfirm')}
      cancelText={t('contratosAtivos.marcosDialog.cancelButton')}
      variant="destructive"
      onConfirm={handleDelete}
    />
    </>
  );
}