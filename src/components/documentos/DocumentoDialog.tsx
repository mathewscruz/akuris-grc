import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconClose, IconUpload, IconFile, IconLink, IconSettings, IconTag, IconAttach } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DateField } from '@/components/ui/date-field';
import { UserSelect } from '@/components/riscos/UserSelect';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { resolveClassificacaoTone } from '@/lib/status-tone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WizardDialog, WizardTab, WizardTabState } from '@/components/ui/wizard-dialog';
import { WizardSummaryCard, WizardSummaryRow } from '@/components/ui/wizard-summary-card';
import { FieldHelpTooltip } from '@/components/ui/field-help-tooltip';
import { logger } from '@/lib/logger';
import { parseDataLocal } from '@/lib/date-utils';
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Documento {
  id: string; nome: string; descricao?: string; tipo: string; classificacao?: string;
  tags?: string[]; arquivo_url?: string; arquivo_url_externa?: string; arquivo_nome?: string;
  arquivo_tipo?: string; arquivo_tamanho?: number; versao: number; is_current_version: boolean;
  status: string; data_vencimento?: string; data_aprovacao?: string; aprovado_por?: string;
  created_by?: string; created_at: string; updated_at: string;
}

interface CategoriaOpcao {
  id: string;
  nome: string;
}

interface DocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento?: Documento;
  /** Categorias da empresa — a coluna existia só na tabela de gestão. */
  categorias?: CategoriaOpcao[];
  onSuccess: () => void;
  initialFile?: File | null;
  initialData?: Partial<{
    nome: string; descricao: string; tipo: string; classificacao: string;
    tags: string[]; status: string; data_vencimento?: Date | undefined;
  }>;
  /** Origem do dialog — quando "docgen", reformula textos para o fluxo de incorporação. */
  originSource?: 'docgen';
}

export function DocumentoDialog({ open, onOpenChange, documento, categorias = [], onSuccess, initialFile, initialData, originSource }: DocumentoDialogProps) {
  const { t } = useLanguage();
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
    categoria_id: '' as string, responsavel_id: '' as string,
  });
  const [newTag, setNewTag] = useState('');
  const [aprovadorId, setAprovadorId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let base = documento
      ? {
          nome: documento.nome, descricao: documento.descricao || '',
          tipo: documento.tipo, classificacao: documento.classificacao || 'interna',
          tags: documento.tags || [], requer_aprovacao: (documento as any).requer_aprovacao || false,
          status: documento.status,
          // parseDataLocal, não `new Date`: a coluna é `date` puro, e lida
          // como meia-noite UTC ela vira o dia ANTERIOR no formulário — cada
          // edição salva movia o vencimento um dia para trás. A trilha de
          // auditoria pegou isso no primeiro dia: 2027-01-14 → 2027-01-13 num
          // edit em que ninguém tocou na data.
          data_vencimento: documento.data_vencimento ? parseDataLocal(documento.data_vencimento) : undefined,
          categoria_id: (documento as { categoria_id?: string | null }).categoria_id || '',
          responsavel_id: (documento as { responsavel_id?: string | null }).responsavel_id || '',
        }
      : { nome: '', descricao: '', tipo: 'documento', classificacao: 'interna', tags: [], requer_aprovacao: false, status: 'ativo', data_vencimento: undefined, categoria_id: '', responsavel_id: '' };

    if (initialData) {
      base = { ...base, ...initialData, tags: initialData.tags ?? base.tags, data_vencimento: initialData.data_vencimento ?? base.data_vencimento } as typeof base;
    }
    setFormData(base);
    setSelectedFile(initialFile || null);
    setArquivoUrlExterna(documento?.arquivo_url_externa || '');
    setArquivoModo(documento?.arquivo_url_externa ? 'url' : 'upload');
    setNewTag('');
    setAprovadorId('');
    setActiveTab('identificacao');
    setInitialSnapshot(JSON.stringify({ ...base, data_vencimento: base.data_vencimento?.toISOString() ?? null }));
  }, [documento, open, initialFile, initialData]);

  const isDirty =
    JSON.stringify({ ...formData, data_vencimento: formData.data_vencimento?.toISOString() ?? null }) !== initialSnapshot;
  const update = (patch: Partial<typeof formData>) => setFormData((p) => ({ ...p, ...patch }));

  const urlInvalida = useMemo(() => {
    if (arquivoModo !== 'url') return false;
    const value = arquivoUrlExterna.trim();
    if (!value) return false;
    try {
      const parsed = new URL(value);
      return !/^https?:$/.test(parsed.protocol);
    } catch {
      return true;
    }
  }, [arquivoModo, arquivoUrlExterna]);

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
      toast({ title: t('documentos.dialogs.nomeObrigatorio'), description: t('documentos.dialogs.nomeObrigatorioDescricao'), variant: "destructive" });
      return;
    }

    if (formData.requer_aprovacao && !documento && !aprovadorId) {
      setActiveTab('classificacao');
      toast({ title: t('documentos.dialogs.aprovadorObrigatorioFluxo'), variant: 'destructive' });
      return;
    }

    if (urlInvalida) {
      setActiveTab('anexo');
      toast({ title: t('documentos.dialogs.urlInvalidaInline'), variant: 'destructive' });
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
        categoria_id: formData.categoria_id || null,
        responsavel_id: formData.responsavel_id || null,
        empresa_id: profileData.empresa_id, created_by: userData.user.id,
      };

      let documentoId = documento?.id;
      if (documento) {
        const { error } = await supabase.from('documentos').update(documentoData).eq('id', documento.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('documentos')
          .insert([documentoData])
          .select('id')
          .single();
        if (error) throw error;
        documentoId = inserted?.id;
      }

      // Instancia o fluxo de aprovação: o toggle passa a criar mesmo a solicitação.
      if (formData.requer_aprovacao && aprovadorId && documentoId) {
        const { data: existente } = await supabase
          .from('documentos_aprovacoes')
          .select('id')
          .eq('documento_id', documentoId)
          .eq('aprovador_id', aprovadorId)
          .maybeSingle();

        if (!existente) {
          const { error: aprovError } = await supabase.from('documentos_aprovacoes').insert([{
            documento_id: documentoId,
            aprovador_id: aprovadorId,
            status: 'pendente',
            comentarios: null,
            data_aprovacao: null,
            tipo_acao: 'solicitacao',
            solicitado_por: userData.user.id,
            data_solicitacao: new Date().toISOString(),
          }]);
          if (aprovError) {
            logger.error('Erro ao criar solicitação de aprovação:', aprovError);
          } else {
            try {
              await supabase.functions.invoke('send-approval-notification', {
                body: { documento_id: documentoId, aprovador_id: aprovadorId, solicitante_id: userData.user.id },
              });
            } catch (emailError) {
              logger.error('Erro ao notificar aprovador:', emailError);
            }
            toast({ title: t('documentos.dialogs.solicitacaoAutomatica') });
          }
        }
      }

      if (!isDocGenFlow) {
        toast({ title: documento ? t('documentos.dialogs.documentoAtualizado') : t('documentos.dialogs.documentoCriado') });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao salvar documento:', error);
      toast({
        title: t('documentos.dialogs.erroAoSalvar'),
        description: error instanceof Error ? error.message : t('documentos.dialogs.tenteNovamenteGeral'),
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
  const classifState: WizardTabState = formData.requer_aprovacao && !aprovadorId && !documento
    ? 'partial'
    : formData.data_vencimento ? 'complete' : 'pending';
  const tagsState: WizardTabState = formData.tags.length > 0 ? 'complete' : 'pending';
  const anexoState: WizardTabState = urlInvalida
    ? 'partial'
    : selectedFile || arquivoUrlExterna || documento?.arquivo_nome
      ? 'complete'
      : 'pending';

  const tabs: WizardTab[] = useMemo(() => [
    {
      id: 'identificacao', label: t('documentos.dialogs.identificacao'), icon: IconFile, state: identState, hint: t('documentos.dialogs.identificacaoHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('documentos.dialogs.nomeCampo')} <span className="text-destructive">*</span>
                <FieldHelpTooltip content="Nome descritivo do documento." />
              </Label>
              <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} placeholder={t('documentos.dialogs.placeholderNome')} />
            </div>
            <div className="space-y-2">
              <Label>{t('documentos.dialogs.tipoObrigatorio')}</Label>
              <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">{t('documentos.lista.documento')}</SelectItem>
                  <SelectItem value="politica">{t('documentos.lista.politica')}</SelectItem>
                  <SelectItem value="procedimento">{t('documentos.lista.procedimento')}</SelectItem>
                  <SelectItem value="instrucao">{t('documentos.lista.instrucao')}</SelectItem>
                  <SelectItem value="formulario">{t('documentos.lista.formulario')}</SelectItem>
                  <SelectItem value="certificado">{t('documentos.lista.certificado')}</SelectItem>
                  <SelectItem value="contrato">{t('documentos.lista.contrato')}</SelectItem>
                  <SelectItem value="relatorio">{t('documentos.lista.relatorio')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('documentos.dialogs.descricao')}</Label>
            <Textarea value={formData.descricao} onChange={(e) => update({ descricao: e.target.value })} rows={4} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-categoria">{t('documentos.lista.categoria')}</Label>
              <Select
                value={formData.categoria_id || 'nenhuma'}
                onValueChange={(v) => update({ categoria_id: v === 'nenhuma' ? '' : v })}
              >
                <SelectTrigger id="doc-categoria"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">{t('documentos.dialogs.semCategoria')}</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-responsavel" className="flex items-center gap-1">
                {t('documentos.lista.responsavel')}
                <FieldHelpTooltip content={t('documentos.dialogs.responsavelAjuda')} />
              </Label>
              {/* Um prazo sem dono não é processo, é só uma data: é a quem o
                  vencimento cobra. */}
              <UserSelect
                id="doc-responsavel"
                value={formData.responsavel_id || undefined}
                onValueChange={(v) => update({ responsavel_id: v })}
                placeholder={t('documentos.dialogs.selecioneResponsavel')}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'classificacao', label: t('documentos.dialogs.classificacaoEStatus'), icon: IconSettings, state: classifState, hint: t('documentos.dialogs.classificacaoEStatusHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                {t('documentos.dialogs.classificacaoObrigatorio')} <span className="text-destructive">*</span>
                <FieldHelpTooltip content="Define quem pode visualizar o documento." />
              </Label>
              <Select value={formData.classificacao} onValueChange={(v) => update({ classificacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">{t('documentos.lista.publica')}</SelectItem>
                  <SelectItem value="interna">{t('documentos.lista.interna')}</SelectItem>
                  <SelectItem value="restrita">{t('documentos.lista.restrita')}</SelectItem>
                  <SelectItem value="confidencial">{t('documentos.lista.confidencial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('documentos.lista.status')}</Label>
              <Select value={formData.status} onValueChange={(v) => update({ status: v })} disabled={formData.requer_aprovacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">{t('documentos.lista.ativo')}</SelectItem>
                  <SelectItem value="inativo">{t('documentos.lista.inativo')}</SelectItem>
                  <SelectItem value="arquivado">{t('documentos.lista.arquivado')}</SelectItem>
                  <SelectItem value="pendente">{t('documentos.dialogs.pendenteAprovacaoStatus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('documentos.dialogs.dataVencimento')}</Label>
            <DateField
              value={formData.data_vencimento ? format(formData.data_vencimento, 'yyyy-MM-dd') : null}
              onChange={(iso) => update({ data_vencimento: iso ? new Date(`${iso}T00:00:00`) : undefined })}
              placeholder={t('documentos.dialogs.selecioneData')}
              fromDate={new Date()}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                {t('documentos.dialogs.requerAprovacao')}
                <FieldHelpTooltip content="Documento entrará em status pendente até ser aprovado." />
              </Label>
              <p className="text-xs text-muted-foreground">{t('documentos.dialogs.requerAprovacaoDica')}</p>
            </div>
            <Switch
              checked={formData.requer_aprovacao}
              onCheckedChange={(c) => {
                update({ requer_aprovacao: c, status: c ? 'pendente' : 'ativo' });
                if (!c) setAprovadorId('');
              }}
            />
          </div>
          {formData.requer_aprovacao && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Label className="flex items-center gap-1">
                {t('documentos.dialogs.aprovadorLabel')} <span className="text-destructive">*</span>
              </Label>
              <UserSelect
                value={aprovadorId}
                onValueChange={setAprovadorId}
                placeholder={t('documentos.dialogs.aprovadorPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('documentos.dialogs.aprovadorHint')}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'tags', label: t('documentos.dialogs.tags'), icon: IconTag, state: tagsState, hint: t('documentos.dialogs.tagsHint'),
      content: (
        <div className="space-y-4 max-w-2xl">
          <Label className="flex items-center gap-1">
            {t('documentos.dialogs.tags')}
            <FieldHelpTooltip content="Use tags para organizar e buscar documentos." />
          </Label>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="flex items-center gap-1">
                {tag}
                <IconClose className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
              </Badge>
            ))}
            {formData.tags.length === 0 && (
              <span className="text-xs text-muted-foreground italic">{t('documentos.dialogs.nenhumaTag')}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t('documentos.dialogs.placeholderAdicionarTag')}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <Button type="button" variant="outline" onClick={handleAddTag}>{t('documentos.dialogs.adicionar')}</Button>
          </div>
        </div>
      ),
    },
    {
      id: 'anexo', label: t('documentos.dialogs.anexo'), icon: IconAttach, state: anexoState, hint: t('documentos.dialogs.anexoHint'),
      content: (
        <div className="space-y-4 max-w-3xl">
          <Tabs value={arquivoModo} onValueChange={(v) => setArquivoModo(v as 'upload' | 'url')}>
            <TabsList>
              <TabsTrigger value="upload"><IconUpload className="h-4 w-4 mr-2" />Upload</TabsTrigger>
              <TabsTrigger value="url"><IconLink className="h-4 w-4 mr-2" />{t('documentos.dialogs.urlExterna')}</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-2">
              {documento?.arquivo_nome && !selectedFile && (
                <div className="flex items-center gap-2 p-2 border rounded">
                  <IconFile className="h-4 w-4" />
                  <span className="text-sm">{documento.arquivo_nome}</span>
                  <span className="text-xs text-muted-foreground">(v{documento.versao} - {formatFileSize(documento.arquivo_tamanho || 0)})</span>
                </div>
              )}
              <Input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png" />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <IconUpload className="h-4 w-4 mr-2" />
                {selectedFile ? t('documentos.dialogs.trocarArquivo') : documento ? t('documentos.dialogs.atualizarArquivo') : t('documentos.dialogs.selecionarArquivo')}
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 border rounded bg-muted">
                  <IconFile className="h-4 w-4" />
                  <span className="text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    <IconClose className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-2">
              <Input type="url" value={arquivoUrlExterna} onChange={(e) => setArquivoUrlExterna(e.target.value)}
                aria-invalid={urlInvalida}
                className={cn(urlInvalida && 'border-destructive focus-visible:ring-destructive')}
                placeholder={t('documentos.dialogs.placeholderUrlExterna')} />
              <p className={cn('text-xs', urlInvalida ? 'text-destructive' : 'text-muted-foreground')}>
                {urlInvalida ? t('documentos.dialogs.urlInvalidaInline') : t('documentos.dialogs.colePublico')}
              </p>
            </TabsContent>
          </Tabs>
        </div>
      ),
    },
  ], [formData, aprovadorId, urlInvalida, arquivoModo, arquivoUrlExterna, selectedFile, documento, newTag, identState, classifState, tagsState, anexoState]);

  const summary = (
    <WizardSummaryCard title={t('documentos.dialogs.resumoDocumento')}>
      <WizardSummaryRow label={t('documentos.dialogs.nomeCampo')} value={formData.nome || <span className="text-muted-foreground italic">{t('documentos.dialogs.semNome')}</span>} highlight />
      <WizardSummaryRow label={t('documentos.dialogs.tipoObrigatorio')} value={<span>{formatStatus(formData.tipo)}</span>} />
      <WizardSummaryRow
        label={t('documentos.dialogs.classificacaoObrigatorio')}
        value={<StatusBadge {...resolveClassificacaoTone(formData.classificacao)}>{formatStatus(formData.classificacao)}</StatusBadge>}
      />
      <WizardSummaryRow label={t('documentos.dialogs.tags')} value={formData.tags.length} />
      <WizardSummaryRow
        label={t('documentos.dialogs.anexo')}
        value={selectedFile?.name || arquivoUrlExterna || documento?.arquivo_nome || <span className="text-muted-foreground italic">{t('documentos.dialogs.semAnexo')}</span>}
      />
    </WizardSummaryCard>
  );

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isDocGenFlow
          ? t('documentos.dialogs.confirmarDadosIncorporar')
          : documento ? t('documentos.dialogs.editarDocumento') : t('documentos.dialogs.novoDocumentoTitulo')
      }
      description={
        isDocGenFlow
          ? t('documentos.dialogs.passoDocGen')
          : documento ? t('documentos.dialogs.atualizeInformacoes') : t('documentos.dialogs.adicioneNovoDocumento')
      }
      icon={IconFile}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={
        isDocGenFlow
          ? t('documentos.dialogs.incorporarDocumento')
          : documento ? t('documentos.dialogs.atualizar') : t('documentos.dialogs.criar')
      }
      isSubmitting={loading || uploading}
      submitDisabled={!formData.nome.trim() || loading || urlInvalida || (formData.requer_aprovacao && !documento && !aprovadorId)}
      isDirty={isDocGenFlow ? true : isDirty}
      size="xl"
    />
  );
}
