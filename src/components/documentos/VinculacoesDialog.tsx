import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DialogShell } from '@/components/ui/dialog-shell';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Link, Trash2, FileText, Shield, AlertTriangle, CheckCircle, Building, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveTipoVinculacaoTone } from '@/lib/status-tone';
import { formatStatus } from '@/lib/text-utils';
import { logger } from '@/lib/logger';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface Documento {
  id: string;
  nome: string;
  tipo: string;
}

interface Vinculacao {
  id: string;
  modulo: string;
  vinculo_id: string;
  tipo_vinculacao: string;
  observacoes?: string;
  created_at: string;
  // Dados do item vinculado
  vinculo_nome?: string;
  vinculo_numero?: string;
}

interface VinculacoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: Documento;
  empresaId?: string | null;
}

const modulosDisponiveis = [
  { value: 'contrato', label: 'Contratos', icon: FileText },
  { value: 'auditoria', label: 'Auditorias', icon: CheckCircle },
  { value: 'risco', label: 'Riscos', icon: AlertTriangle },
  { value: 'controle', label: 'Controles', icon: Shield },
  { value: 'ativo', label: 'Ativos', icon: Building },
];

const tiposVinculacao = [
  'relacionado',
  'evidencia',
  'suporte',
  'implementacao',
  'aprovacao',
  'revisao'
];

export function VinculacoesDialog({ open, onOpenChange, documento, empresaId }: VinculacoesDialogProps) {
  const [vinculacoes, setVinculacoes] = useState<Vinculacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    modulo: '',
    vinculo_id: '',
    tipo_vinculacao: 'relacionado',
    observacoes: ''
  });
  const [itemsDisponiveis, setItemsDisponiveis] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVinculacoes();
    }
  }, [open, documento.id]);

  useEffect(() => {
    if (formData.modulo) {
      fetchItemsDisponiveis(formData.modulo);
    }
  }, [formData.modulo]);

  const fetchVinculacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos_vinculacoes')
        .select('*')
        .eq('documento_id', documento.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar dados detalhados dos itens vinculados
      const vinculacoesComDetalhes = await Promise.all(
        (data || []).map(async (vinculacao) => {
          let vinculo_nome = '';
          let vinculo_numero = '';

          try {
            switch (vinculacao.modulo) {
              case 'contrato':
                const { data: contratoData } = await supabase
                  .from('contratos')
                  .select('nome, numero_contrato')
                  .eq('id', vinculacao.vinculo_id)
                  .single();
                if (contratoData) {
                  vinculo_nome = contratoData.nome;
                  vinculo_numero = contratoData.numero_contrato;
                }
                break;
              case 'auditoria':
                const { data: auditoriaData } = await supabase
                  .from('auditorias')
                  .select('nome')
                  .eq('id', vinculacao.vinculo_id)
                  .single();
                if (auditoriaData) {
                  vinculo_nome = auditoriaData.nome;
                }
                break;
              case 'risco':
                const { data: riscoData } = await supabase
                  .from('riscos')
                  .select('nome')
                  .eq('id', vinculacao.vinculo_id)
                  .single();
                if (riscoData) {
                  vinculo_nome = riscoData.nome;
                }
                break;
              case 'controle':
                const { data: controleData } = await supabase
                  .from('controles')
                  .select('nome')
                  .eq('id', vinculacao.vinculo_id)
                  .single();
                if (controleData) {
                  vinculo_nome = controleData.nome;
                }
                break;
              case 'ativo':
                const { data: ativoData } = await supabase
                  .from('ativos')
                  .select('nome')
                  .eq('id', vinculacao.vinculo_id)
                  .single();
                if (ativoData) {
                  vinculo_nome = ativoData.nome;
                }
                break;
            }
          } catch (error) {
            logger.error('Erro ao buscar detalhes do item vinculado', { error: (error as Error)?.message, module: 'documentos' });
          }

          return {
            ...vinculacao,
            vinculo_nome,
            vinculo_numero
          };
        })
      );

      setVinculacoes(vinculacoesComDetalhes);
    } catch (error) {
      logger.error('Erro ao buscar vinculações', { error: (error as Error)?.message, module: 'documentos' });
      toast({
        title: "Erro ao carregar vinculações",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsDisponiveis = async (modulo: string) => {
    try {
      let query;
      let selectFields;

      switch (modulo) {
        case 'contrato':
          selectFields = 'id, nome, numero_contrato';
          query = supabase.from('contratos').select(selectFields);
          break;
        case 'auditoria':
          selectFields = 'id, nome';
          query = supabase.from('auditorias').select(selectFields);
          break;
        case 'risco':
          selectFields = 'id, nome';
          query = supabase.from('riscos').select(selectFields);
          break;
        case 'controle':
          selectFields = 'id, nome';
          query = supabase.from('controles').select(selectFields);
          break;
        case 'ativo':
          selectFields = 'id, nome';
          query = supabase.from('ativos').select(selectFields);
          break;
        default:
          setItemsDisponiveis([]);
          return;
      }

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query.order('nome');
      if (error) throw error;

      setItemsDisponiveis(data || []);
    } catch (error) {
      logger.error('Erro ao buscar itens disponíveis', { error: (error as Error)?.message, module: 'documentos' });
      setItemsDisponiveis([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.modulo || !formData.vinculo_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione o módulo e o item para vincular.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const vinculacaoData = {
        documento_id: documento.id,
        modulo: formData.modulo,
        vinculo_id: formData.vinculo_id,
        tipo_vinculacao: formData.tipo_vinculacao,
        observacoes: formData.observacoes.trim() || null,
      };

      const { error } = await supabase
        .from('documentos_vinculacoes')
        .insert([vinculacaoData]);

      if (error) throw error;

      toast({
        title: "Vinculação criada",
        description: "A vinculação foi criada com sucesso.",
      });

      resetForm();
      fetchVinculacoes();
    } catch (error) {
      logger.error('Erro ao criar vinculação', { error: (error as Error)?.message, module: 'documentos' });
      toast({
        title: "Erro ao criar vinculação",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('documentos_vinculacoes')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: "Vinculação removida",
        description: "A vinculação foi removida com sucesso.",
      });

      fetchVinculacoes();
    } catch (error) {
      logger.error('Erro ao remover vinculação', { error: (error as Error)?.message, module: 'documentos' });
      toast({
        title: "Erro ao remover vinculação",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm({ open: false, id: '' });
    }
  };

  const resetForm = () => {
    setFormData({
      modulo: '',
      vinculo_id: '',
      tipo_vinculacao: 'relacionado',
      observacoes: ''
    });
    setShowForm(false);
    setItemsDisponiveis([]);
  };

  const getModuloIcon = (modulo: string) => {
    const moduloConfig = modulosDisponiveis.find(m => m.value === modulo);
    const Icon = moduloConfig?.icon || Link;
    return <Icon className="h-4 w-4" />;
  };

  const getModuloLabel = (modulo: string) => {
    const moduloConfig = modulosDisponiveis.find(m => m.value === modulo);
    return moduloConfig?.label || modulo;
  };

  const getTipoVinculacaoBadge = (tipo: string) => (
    <StatusBadge size="sm" {...resolveTipoVinculacaoTone(tipo)}>
      {formatStatus(tipo)}
    </StatusBadge>
  );

  return (
    <>
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Link}
      title="Vinculações do Documento"
      description={`Gerencie as vinculações do documento "${documento.nome}" com outros módulos do sistema.`}
      size="lg"
      hideFooter
    >
        <div className="space-y-6">
          {!showForm ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Vinculações Existentes</h3>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Vinculação
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <AkurisPulse size={32} />
                </div>
              ) : vinculacoes.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-32">
                    <Link className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma vinculação criada ainda</p>
                    <p className="text-sm text-muted-foreground">Clique em "Nova Vinculação" para começar</p>
                  </CardContent>
                </Card>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Item Vinculado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vinculacoes.map((vinculacao) => (
                      <TableRow key={vinculacao.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getModuloIcon(vinculacao.modulo)}
                            <span className="font-medium">{getModuloLabel(vinculacao.modulo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{vinculacao.vinculo_nome || 'Item não encontrado'}</div>
                            {vinculacao.vinculo_numero && (
                              <div className="text-sm text-muted-foreground">
                                {vinculacao.vinculo_numero}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getTipoVinculacaoBadge(vinculacao.tipo_vinculacao)}</TableCell>
                        <TableCell>{vinculacao.observacoes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Navegar para o item vinculado
                                const path = `/${vinculacao.modulo}s`;
                                window.open(path, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirm({ open: true, id: vinculacao.id })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Nova Vinculação</h3>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Voltar
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modulo">Módulo *</Label>
                  <Select value={formData.modulo} onValueChange={(value) => setFormData(prev => ({ ...prev, modulo: value, vinculo_id: '' }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o módulo" />
                    </SelectTrigger>
                    <SelectContent>
                      {modulosDisponiveis.map((modulo) => {
                        const Icon = modulo.icon;
                        return (
                          <SelectItem key={modulo.value} value={modulo.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {modulo.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_vinculacao">Tipo de Vinculação</Label>
                  <Select value={formData.tipo_vinculacao} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_vinculacao: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposVinculacao.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.modulo && (
                <div className="space-y-2">
                  <Label htmlFor="vinculo_id">Item para Vincular *</Label>
                  <Select value={formData.vinculo_id} onValueChange={(value) => setFormData(prev => ({ ...prev, vinculo_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o item" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemsDisponiveis.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="space-y-1">
                            <div>{item.nome}</div>
                            {item.numero_contrato && (
                              <div className="text-sm text-muted-foreground">
                                {item.numero_contrato}
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações sobre a vinculação"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <AkurisPulse size={16} className="mr-2" />
                      Criando...
                    </>
                  ) : (
                    'Criar Vinculação'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
    </DialogShell>

    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
      title="Remover Vinculação"
      description="Tem certeza que deseja remover esta vinculação? Esta ação não pode ser desfeita."
      confirmText="Remover"
      cancelText="Cancelar"
      variant="destructive"
      onConfirm={handleDelete}
    />
    </>
  );
}