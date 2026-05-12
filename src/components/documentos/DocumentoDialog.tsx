import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Upload, X, CalendarIcon, File, Link2, FileText, Settings2, Tag, Paperclip } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { logger } from '@/lib/logger';
import { formatStatus } from '@/lib/text-utils';

interface Documento {
  id: string; nome: string; descricao?: string; tipo: string; classificacao?: string;
  tags?: string[]; arquivo_url?: string; arquivo_url_externa?: string; arquivo_nome?: string;
  arquivo_tipo?: string; arquivo_tamanho?: number; versao: number; is_current_version: boolean;
  status: string; data_vencimento?: string; data_aprovacao?: string; aprovado_por?: string;
  created_by?: string; created_at: string; updated_at: string;
}

interface DocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento?: Documento;
  onSuccess: () => void;
  initialFile?: File | null;
  initialData?: Partial<{
    nome: string; descricao: string; tipo: string; classificacao: string;
    tags: string[]; status: string; data_vencimento?: Date | undefined;
  }>;
  /** Origem do dialog — quando "docgen", reformula textos para o fluxo de incorporação. */
  originSource?: 'docgen';
}

const CLASSIF_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  publica: 'outline', interna: 'secondary', restrita: 'default', confidencial: 'destructive',
};

export function DocumentoDialog({ open, onOpenChange, documento, onSuccess, initialFile, initialData, originSource }: DocumentoDialogProps) {
  const isDocGenFlow = originSource === 'docgen';
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [arquivoModo, setArquivoModo] = useState<'upload' | 'url'>('upload');
  const [arquivoUrlExterna, setArquivoUrlExterna] = useState('');
  const [activeTab, setActiveTab] = useState('identificacao');
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [formData, setFormData] = useState({
    nome: '', descricao: '', tipo: 'documento', classificacao: 'interna',
    tags: [] as string[], requer_aprovacao: false, status: 'ativo',
    data_vencimento: undefined as Date | undefined,
  });
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let base = documento
      ? {
          nome: documento.nome, descricao: documento.descricao || '',
          tipo: documento.tipo, classificacao: documento.classificacao || 'interna',
          tags: documento.tags || [], requer_aprovacao: (documento as any).requer_aprovacao || false,
          status: documento.status,
          data_vencimento: documento.data_vencimento ? new Date(documento.data_vencimento) : undefined,
        }
      : { nome: '', descricao: '', tipo: 'documento', classificacao: 'interna', tags: [], requer_aprovacao: false, status: 'ativo', data_vencimento: undefined };

    if (initialData) {
      base = { ...base, ...initialData, tags: initialData.tags ?? base.tags, data_vencimento: initialData.data_vencimento ?? base.data_vencimento } as typeof base;
    }
    setFormData(base);
    setSelectedFile(initialFile || null);
    setArquivoUrlExterna(documento?.arquivo_url_externa || '');
    setArquivoModo(documento?.arquivo_url_externa ? 'url' : 'upload');
    setNewTag('');
    setActiveTab('identificacao');
    setInitialSnapshot(JSON.stringify({ ...base, data_vencimento: base.data_vencimento?.toISOString() ?? null }));
  }, [documento, open, initialFile, initialData]);

  const isDirty =
    JSON.stringify({ ...formData, data_vencimento: formData.data_vencimento?.toISOString() ?? null }) !== initialSnapshot;
  const update = (patch: Partial<typeof formData>) => setFormData((p) => ({ ...p, ...patch }));

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      update({ tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };
  const handleRemoveTag = (t: string) => update({ tags: formData.tags.filter((x) => x !== t) });

  const uploadFile = async (file: File): Promise<string> => {
    // Scope file path by empresa_id to satisfy storage RLS policy
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuário não autenticado');
    const { data: profileData } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', userData.user.id)
      .single();
    if (!profileData?.empresa_id) throw new Error('Empresa não encontrada');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${profileData.empresa_id}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, file);
    if (uploadError) throw uploadError;
    return filePath;
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      setActiveTab('identificacao');
      toast({ title: "Nome obrigatório", description: "Informe o nome do documento.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');
      const { data: profileData } = await supabase.from('profiles').select('empresa_id').eq('user_id', userData.user.id).single();
      if (!profileData?.empresa_id) throw new Error('Empresa não encontrada');

      let arquivo_url = documento?.arquivo_url;
      let arquivo_nome = documento?.arquivo_nome;
      let arquivo_tipo = documento?.arquivo_tipo;
      let arquivo_tamanho = documento?.arquivo_tamanho;
      let arquivo_url_externa: string | null = arquivoUrlExterna.trim() || null;
      let versao = documento?.versao || 1;

      if (arquivoModo === 'upload') {
        arquivo_url_externa = null;
        if (selectedFile) {
          setUploading(true);
          arquivo_url = await uploadFile(selectedFile);
          arquivo_nome = selectedFile.name;
          arquivo_tipo = selectedFile.type;
          arquivo_tamanho = selectedFile.size;
          if (documento) versao = documento.versao + 1;
        }
      } else {
        if (arquivo_url_externa) {
          try { new URL(arquivo_url_externa); }
          catch { throw new Error('URL inválida. Informe um link completo (https://...)'); }
        }
        arquivo_url = undefined; arquivo_nome = undefined; arquivo_tipo = undefined; arquivo_tamanho = undefined;
        if (documento && documento.arquivo_url_externa !== arquivo_url_externa) versao = documento.versao + 1;
      }

      const documentoData = {
        nome: formData.nome.trim(), descricao: formData.descricao.trim() || null,
        tipo: formData.tipo, classificacao: formData.classificacao,
        tags: formData.tags.length > 0 ? formData.tags : null,
        arquivo_url: arquivo_url ?? null, arquivo_nome: arquivo_nome ?? null,
        arquivo_tipo: arquivo_tipo ?? null, arquivo_tamanho: arquivo_tamanho ?? null,
        arquivo_url_externa, versao, requer_aprovacao: formData.requer_aprovacao,
        status: formData.requer_aprovacao ? 'pendente' : formData.status,
        data_vencimento: formData.data_vencimento ? format(formData.data_vencimento, 'yyyy-MM-dd') : null,
        empresa_id: profileData.empresa_id, created_by: userData.user.id,
      };

      const { error } = documento
        ? await supabase.from('documentos').update(documentoData).eq('id', documento.id)
        : await supabase.from('documentos').insert([documentoData]);
      if (error) throw error;

      if (!isDocGenFlow) {
        toast({ title: documento ? "Documento atualizado" : "Documento criado" });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao salvar documento:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setLoading(false); setUploading(false); }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  // 'complete' só com dados preenchidos pelo usuário (tipo/classificacao/status têm defaults).
  const identState: WizardTabState = formData.nome.trim() && formData.descricao.trim() ? 'complete' : (formData.nome.trim() ? 'partial' : 'pending');
  const classifState: WizardTabState = formData.data_vencimento ? 'complete' : 'pending';
  const tagsState: WizardTabState = formData.tags.length > 0 ? 'complete' : 'pending';
  const anexoState: WizardTabState =
    selectedFile || arquivoUrlExterna || documento?.arquivo_nome ? 'complete' : 'pending';

  const tabs: WizardTab[] = useMemo(() => [
    {
      id: 'identificacao', label: 'Identificação', icon: FileText, state: identState, hint: 'Nome, tipo, descrição',
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Nome <span className="text-destructive">*</span>
                <FieldHelpTooltip content="Nome descritivo do documento." />
              </Label>
              <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} placeholder="Nome do documento" />
            </div>
            <div className="space-y-2">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="politica">Política</SelectItem>
                  <SelectItem value="procedimento">Procedimento</SelectItem>
                  <SelectItem value="instrucao">Instrução</SelectItem>
                  <SelectItem value="formulario">Formulário</SelectItem>
                  <SelectItem value="certificado">Certificado</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={formData.descricao} onChange={(e) => update({ descricao: e.target.value })} rows={4} />
          </div>
        </div>
      ),
    },
    {
      id: 'classificacao', label: 'Classificação & Status', icon: Settings2, state: classifState, hint: 'Confidencialidade e status',
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Classificação <span className="text-destructive">*</span>
                <FieldHelpTooltip content="Define quem pode visualizar o documento." />
              </Label>
              <Select value={formData.classificacao} onValueChange={(v) => update({ classificacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">Pública</SelectItem>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="restrita">Restrita</SelectItem>
                  <SelectItem value="confidencial">Confidencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.data_vencimento && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.data_vencimento ? format(formData.data_vencimento, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={formData.data_vencimento} onSelect={(d) => update({ data_vencimento: d })} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                Requer Aprovação
                <FieldHelpTooltip content="Documento entrará em status pendente até ser aprovado." />
              </Label>
              <p className="text-xs text-muted-foreground">Se habilitado, o documento ficará pendente até aprovação.</p>
            </div>
            <Switch
              checked={formData.requer_aprovacao}
              onCheckedChange={(c) => update({ requer_aprovacao: c, status: c ? 'pendente' : 'ativo' })}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'tags', label: 'Tags', icon: Tag, state: tagsState, hint: 'Palavras-chave',
      content: (
        <div className="space-y-4 max-w-2xl">
          <Label className="flex items-center gap-1">
            Tags
            <FieldHelpTooltip content="Use tags para organizar e buscar documentos." />
          </Label>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="flex items-center gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
              </Badge>
            ))}
            {formData.tags.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Nenhuma tag adicionada</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Adicionar tag e pressionar Enter"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <Button type="button" variant="outline" onClick={handleAddTag}>Adicionar</Button>
          </div>
        </div>
      ),
    },
    {
      id: 'anexo', label: 'Anexo', icon: Paperclip, state: anexoState, hint: 'Arquivo ou URL',
      content: (
        <div className="space-y-4 max-w-3xl">
          <Tabs value={arquivoModo} onValueChange={(v) => setArquivoModo(v as 'upload' | 'url')}>
            <TabsList>
              <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-2" />Upload</TabsTrigger>
              <TabsTrigger value="url"><Link2 className="h-4 w-4 mr-2" />URL Externa</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-2 mt-3">
              {documento?.arquivo_nome && !selectedFile && (
                <div className="flex items-center gap-2 p-2 border rounded">
                  <File className="h-4 w-4" />
                  <span className="text-sm">{documento.arquivo_nome}</span>
                  <span className="text-xs text-muted-foreground">(v{documento.versao} - {formatFileSize(documento.arquivo_tamanho || 0)})</span>
                </div>
              )}
              <Input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png" />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? 'Trocar Arquivo' : documento ? 'Atualizar Arquivo' : 'Selecionar Arquivo'}
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 border rounded bg-muted">
                  <File className="h-4 w-4" />
                  <span className="text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-2 mt-3">
              <Input type="url" value={arquivoUrlExterna} onChange={(e) => setArquivoUrlExterna(e.target.value)}
                placeholder="https://drive.google.com/... ou https://sharepoint.com/..." />
              <p className="text-xs text-muted-foreground">
                Cole o link público ou compartilhado (Google Drive, SharePoint, OneDrive, Dropbox, etc.)
              </p>
            </TabsContent>
          </Tabs>
        </div>
      ),
    },
  ], [formData, arquivoModo, arquivoUrlExterna, selectedFile, documento, newTag, identState, classifState, tagsState, anexoState]);

  const summary = (
    <WizardSummaryCard title="Resumo do Documento">
      <WizardSummaryRow label="Nome" value={formData.nome || <span className="text-muted-foreground italic">Sem nome</span>} highlight />
      <WizardSummaryRow label="Tipo" value={<span>{formatStatus(formData.tipo)}</span>} />
      <WizardSummaryRow
        label="Classificação"
        value={<Badge variant={CLASSIF_VARIANT[formData.classificacao]} className="text-[10px]">{formatStatus(formData.classificacao)}</Badge>}
      />
      <WizardSummaryRow label="Tags" value={formData.tags.length} />
      <WizardSummaryRow
        label="Anexo"
        value={selectedFile?.name || arquivoUrlExterna || documento?.arquivo_nome || <span className="text-muted-foreground italic">Sem anexo</span>}
      />
    </WizardSummaryCard>
  );

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isDocGenFlow
          ? 'Confirmar dados antes de incorporar'
          : documento ? 'Editar Documento' : 'Novo Documento'
      }
      description={
        isDocGenFlow
          ? 'Passo 2 de 2 · O conteúdo gerado pela IA já está anexado. Revise os metadados e confirme a incorporação ao módulo Documentos.'
          : documento ? 'Atualize informações e anexo do documento.' : 'Adicione um novo documento ao sistema.'
      }
      icon={FileText}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={
        isDocGenFlow
          ? 'Incorporar documento'
          : documento ? 'Atualizar' : 'Criar'
      }
      isSubmitting={loading || uploading}
      submitDisabled={!formData.nome.trim() || loading}
      isDirty={isDocGenFlow ? true : isDirty}
      size="xl"
    />
  );
}
