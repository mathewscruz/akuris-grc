import { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  contato_responsavel: string;
  tipo: string;
  status: string;
  categoria: string;
  avaliacao_risco: string;
  data_cadastro: string;
  observacoes: string;
}

interface FornecedorDialogProps {
  fornecedor: Fornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FornecedorDialog({ fornecedor, open, onOpenChange, onSuccess }: FornecedorDialogProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    contato_responsavel: '',
    tipo: 'pessoa_juridica',
    status: 'ativo',
    categoria: '',
    avaliacao_risco: 'baixo',
    data_cadastro: '',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (fornecedor) {
        setFormData({
          nome: fornecedor.nome || '',
          cnpj: fornecedor.cnpj || '',
          email: fornecedor.email || '',
          telefone: fornecedor.telefone || '',
          endereco: fornecedor.endereco || '',
          contato_responsavel: fornecedor.contato_responsavel || '',
          tipo: fornecedor.tipo || 'pessoa_juridica',
          status: fornecedor.status || 'ativo',
          categoria: fornecedor.categoria || '',
          avaliacao_risco: fornecedor.avaliacao_risco || 'baixo',
          data_cadastro: fornecedor.data_cadastro || '',
          observacoes: fornecedor.observacoes || ''
        });
      } else {
        setFormData({
          nome: '',
          cnpj: '',
          email: '',
          telefone: '',
          endereco: '',
          contato_responsavel: '',
          tipo: 'pessoa_juridica',
          status: 'ativo',
          categoria: '',
          avaliacao_risco: 'baixo',
          data_cadastro: new Date().toISOString().split('T')[0],
          observacoes: ''
        });
      }
    }
  }, [fornecedor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome) {
      toast({
        title: "Erro",
        description: "O nome do fornecedor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user?.id)
        .single();

      const fornecedorData = {
        nome: formData.nome,
        cnpj: formData.cnpj,
        email: formData.email,
        telefone: formData.telefone,
        endereco: formData.endereco,
        contato_responsavel: formData.contato_responsavel,
        tipo: formData.tipo,
        status: formData.status,
        categoria: formData.categoria,
        avaliacao_risco: formData.avaliacao_risco,
        data_cadastro: formData.data_cadastro || null,
        observacoes: formData.observacoes,
        empresa_id: profile?.empresa_id
      };

      let error;
      
      if (fornecedor) {
        const { error: updateError } = await supabase
          .from('fornecedores')
          .update(fornecedorData)
          .eq('id', fornecedor.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('fornecedores')
          .insert([fornecedorData]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Fornecedor ${fornecedor ? 'atualizado' : 'cadastrado'} com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar fornecedor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Building2}
      title={fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      size="md"
      onSubmit={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
      submitLabel={fornecedor ? 'Atualizar' : 'Cadastrar'}
      isSubmitting={loading}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do Fornecedor *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome ou razão social"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ/CPF</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@fornecedor.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_responsavel">Contato Responsável</Label>
              <Input
                id="contato_responsavel"
                value={formData.contato_responsavel}
                onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tecnologia">Tecnologia</SelectItem>
                  <SelectItem value="consultoria">Consultoria</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="produtos">Produtos</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="terceirizacao">Terceirização</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avaliacao_risco">Avaliação de Risco</Label>
              <Select value={formData.avaliacao_risco} onValueChange={(value) => setFormData({ ...formData, avaliacao_risco: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_cadastro">Data de Cadastro</Label>
              <Input
                id="data_cadastro"
                type="date"
                value={formData.data_cadastro}
                onChange={(e) => setFormData({ ...formData, data_cadastro: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais sobre o fornecedor..."
                rows={3}
              />
            </div>
          </div>

        </form>
    </DialogShell>
  );
}