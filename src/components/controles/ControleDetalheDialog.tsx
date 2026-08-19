import { useState, useRef } from "react";
import { IconEdit, IconDelete, IconDownload, IconUpload, IconCalendar, IconSend, IconFile, IconMessage, IconPerson, IconMail, IconShield, IconActivity, IconLink, IconAttach, IconTest } from '@/components/icons';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { formatDateOnly } from "@/lib/date-utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { capitalizeText, formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveControleStatusTone, resolveCriticidadeTone, resolveConformityTone } from "@/lib/status-tone";
import { getStatusLabel } from "@/lib/gap-analysis-tokens";
import { conformidadeRequisito } from "@/lib/metrics/requisitos";

import { useControleRequisitos } from "@/hooks/useControleRequisitos";
import { VincularRequisitoControleDialog } from "@/components/controles/VincularRequisitoControleDialog";
import { openStorageFile } from "@/lib/storage";
import { logger } from "@/lib/logger";

/** Bucket da biblioteca partilhada de evidências. */
const EVIDENCE_BUCKET = 'gap-evidence-library';

/** Impressão digital do ficheiro — a biblioteca deduplica por conteúdo. */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
import TestesList from "@/components/controles/TestesList";
import { useLanguage } from "@/contexts/LanguageContext";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { notificarVarios } from '@/lib/notificar';
interface ControleDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controle: any;
  onEdit: () => void;
}

export function ControleDetalheDialog({
  open,
  onOpenChange,
  controle,
  onEdit,
}: ControleDetalheDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [novoComentario, setNovoComentario] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "evidencia" | "comentario"; id: string } | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [vincularOpen, setVincularOpen] = useState(false);

  // Requisitos de framework ligados a este controlo (N para N)
  const { data: requisitosLigados } = useControleRequisitos(open ? controle?.id ?? null : null);

  // Partilha a chave de cache com <TestesList/>: as duas queries pediam
  // ['controles_testes', id] mas esta trazia só `id`. Quem resolvia primeiro
  // enchia a cache, e a lista de testes ficava a renderizar registos sem data
  // nem resultado ("Teste de -"). Buscar as linhas completas nas duas resolve a
  // colisão e poupa um pedido.
  const { data: testesControle } = useQuery({
    queryKey: ['controles_testes', controle?.id],
    enabled: open && !!controle?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controles_testes')
        .select('*')
        .eq('controle_id', controle.id)
        .order('data_teste', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar usuários da empresa para menções
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Buscar comentários
  const { data: comentarios, refetch: refetchComentarios } = useQuery({
    queryKey: ["controle-comentarios", controle?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controles_comentarios")
        .select("*")
        .eq("controle_id", controle.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(c => c.user_id))];

      const { data: users } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);

      const userMap = new Map(users?.map(u => [u.user_id, u.nome]) || []);
      
      return data.map(c => ({
        ...c,
        user_nome: userMap.get(c.user_id) || t("govDialogs.controleDetalheDialog.usuarioFallback")
      }));
    },
    enabled: open && !!controle?.id,
  });

  // Buscar auditorias vinculadas
  const { data: auditoriasVinculadas } = useQuery({
    queryKey: ["controle-auditorias", controle?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controles_auditorias")
        .select(`
          auditoria_id,
          auditoria:auditorias(id, nome, status)
        `)
        .eq("controle_id", controle.id);

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!controle?.id,
  });

  // Evidências do controlo, lidas da biblioteca partilhada: o mesmo ficheiro
  // pode provar este controlo e um requisito de norma sem ser carregado outra vez.
  const { data: evidencias, refetch: refetchEvidencias } = useQuery({
    queryKey: ["controle-evidencias", controle?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_library_links")
        .select("id, created_at, evidencia:evidence_library(id, nome, arquivo_url, arquivo_nome, arquivo_tipo, arquivo_tamanho, bucket)")
        .eq("modulo", "controles")
        .eq("registro_id", controle.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // O que a lista mostra é a evidência; o id que se guarda é o do vínculo,
      // porque remover aqui desliga do controlo sem apagar o ficheiro.
      return (data || [])
        .filter((l: any) => l.evidencia)
        .map((l: any) => ({ ...l.evidencia, link_id: l.id, created_at: l.created_at }));
    },
    enabled: open && !!controle?.id,
  });

  // Filtrar usuários para menção
  const filteredUsers = usuarios?.filter(u => 
    u.nome?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 5);

  // Detectar @ no texto
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setNovoComentario(value);
    setCursorPosition(position);

    const textBeforeCursor = value.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  // Inserir menção
  const insertMention = (user: { user_id: string; nome: string }) => {
    const textBeforeCursor = novoComentario.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = novoComentario.substring(cursorPosition);
    
    const newText = 
      novoComentario.substring(0, atIndex) + 
      `@${user.nome} ` + 
      textAfterCursor;
    
    setNovoComentario(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  // Extrair menções do comentário
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1];
      const user = usuarios?.find(u => u.nome?.includes(mentionName));
      if (user) {
        mentions.push(user.user_id);
      }
    }
    
    return mentions;
  };

  const handleAddComentario = async () => {
    if (!novoComentario.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const mencoes = extractMentions(novoComentario);

      const { error } = await supabase.from("controles_comentarios").insert({
        controle_id: controle.id,
        user_id: userData.user?.id,
        comentario: novoComentario.trim(),
        mencoes: mencoes.length > 0 ? mencoes : null,
      });

      if (error) throw error;

      // Notificar usuários mencionados (in-app + e-mail)
      if (mencoes.length > 0) {
        // In-app de uma vez: um aviso no fim, e não um toast por menção falhada.
        await notificarVarios(mencoes, {
          titulo: t('controlesAuditorias.cddMentionNotifyTitle'),
          mensagem: t('controlesAuditorias.cddMentionNotifyMessage', { nome: controle.nome }),
          linkPara: `/controles?detalhe=${controle.id}`,
        });

        for (const userId of mencoes) {
          // Enviar e-mail de notificação
          try {
            await supabase.functions.invoke('send-controle-mention-notification', {
              body: {
                user_id: userId,
                controle_id: controle.id,
                controle_nome: controle.nome,
                mencionado_por: userData.user?.id,
                comentario: novoComentario.trim()
              }
            });
          } catch (emailError) {
            console.error("Erro ao enviar e-mail de menção:", emailError);
          }
        }
      }

      setNovoComentario("");
      await refetchComentarios();
      queryClient.invalidateQueries({ queryKey: ["controle-comentarios", controle.id] });
      toast.success(t('controlesAuditorias.cddCommentAdded'));
    } catch (error: any) {
      toast.error(error.message || t('controlesAuditorias.cddCommentAddError'));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComentario = async (comentarioId: string) => {
    try {
      const { error } = await supabase
        .from("controles_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;

      refetchComentarios();
      toast.success(t('controlesAuditorias.cddCommentRemoved'));
    } catch (error: any) {
      toast.error(error.message || t('controlesAuditorias.cddCommentRemoveError'));
    }
    setDeleteTarget(null);
  };

  // Upload de evidência
  const handleUploadEvidencia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('controlesAuditorias.cddInvalidFileType'));
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('controlesAuditorias.cddFileTooLarge'));
      return;
    }

    setIsUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const empresaId = controle.empresa_id;
      const hash = await sha256(await file.arrayBuffer());

      // Deduplica por conteúdo dentro da empresa: o mesmo ficheiro entra uma vez
      // na biblioteca e ganha só mais um vínculo.
      const { data: existente } = await supabase
        .from("evidence_library")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("arquivo_hash", hash)
        .maybeSingle();

      let evidenceId = existente?.id ?? null;

      if (!evidenceId) {
        // Guarda o caminho dentro do bucket, não uma URL "public": o bucket é
        // privado e `openStorageFile` reassina a partir do caminho.
        const fileName = `${empresaId}/${hash.slice(0, 16)}-${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: nova, error: insertError } = await supabase
          .from("evidence_library")
          .insert({
            empresa_id: empresaId,
            nome: file.name,
            arquivo_url: fileName,
            arquivo_nome: file.name,
            arquivo_tamanho: file.size,
            arquivo_tipo: file.type,
            arquivo_hash: hash,
            bucket: EVIDENCE_BUCKET,
            created_by: userData.user?.id,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        evidenceId = nova.id;
      }

      // O ficheiro pode já estar ligado a este mesmo controlo — anexar duas
      // vezes não é erro do utilizador, é um aviso.
      if (existente?.id) {
        const { data: jaLigada } = await supabase
          .from("evidence_library_links")
          .select("id")
          .eq("evidence_id", evidenceId)
          .eq("modulo", "controles")
          .eq("registro_id", controle.id)
          .maybeSingle();
        if (jaLigada) {
          toast.info(t('controlesAuditorias.cddEvidenciaJaAnexada'));
          return;
        }
      }

      const { error: linkError } = await supabase.from("evidence_library_links").insert({
        empresa_id: empresaId,
        evidence_id: evidenceId,
        modulo: "controles",
        registro_id: controle.id,
        vinculo_tipo: "manual",
        aceito_em: new Date().toISOString(),
        created_by: userData.user?.id,
      });
      if (linkError) throw linkError;

      refetchEvidencias();
      toast.success(t('controlesAuditorias.cddEvidenciaAdded'));
    } catch (error: any) {
      // A mensagem crua do Supabase vem em inglês ("Bucket not found", "new row
      // violates row-level security policy") e não diz nada ao utilizador.
      logger.error('Falha ao anexar evidência ao controlo', error);
      toast.error(t('controlesAuditorias.cddUploadError'));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // Desliga a evidência deste controlo. O ficheiro fica na biblioteca porque
  // pode estar a provar outro registo — apagá-lo aqui destruiria essa prova.
  const handleDeleteEvidencia = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from("evidence_library_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      refetchEvidencias();
      toast.success(t('controlesAuditorias.cddEvidenciaRemoved'));
    } catch (error: any) {
      toast.error(error.message || t('controlesAuditorias.cddEvidenciaRemoveError'));
    }
    setDeleteTarget(null);
  };

  // Download de evidência (bucket privado — signed URL)
  const handleDownload = async (evidencia: any) => {
    if (!evidencia?.arquivo_url) return;
    // Entradas migradas do repositório antigo mantêm o bucket de origem.
    const ok = await openStorageFile(evidencia.bucket || EVIDENCE_BUCKET, evidencia.arquivo_url);
    if (!ok) toast.error(t('controlesAuditorias.cddDownloadError'));
  };

  // Formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Renderizar comentário com menções destacadas
  const renderCommentWithMentions = (text: string) => {
    const parts = text.split(/(@\w+(?:\s+\w+)?)/g);
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span key={index} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (!controle) return null;

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={controle.nome}
        icon={IconShield}
        size="lg"
        hideFooter
        disableShortcuts
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <IconShield className="h-3 w-3" />
                {capitalizeText(controle.tipo)}
              </Badge>
              <StatusBadge {...resolveCriticidadeTone(controle.criticidade)}>
                {formatStatus(controle.criticidade)}
              </StatusBadge>
              <StatusBadge {...resolveControleStatusTone(controle.status)}>
                {formatStatus(controle.status)}
              </StatusBadge>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <IconEdit className="h-4 w-4 mr-2" />
              {t('controlesAuditorias.cddEdit')}
            </Button>
          </div>

          {/* Metadados do controle - linha separada */}
          <div className="flex-shrink-0 flex flex-wrap gap-4 items-center text-sm bg-card rounded-lg p-3 border border-border">
            {controle.responsavel_nome && (
              <div className="flex items-center gap-2">
                <IconPerson className="h-4 w-4 text-primary" />
                <span className="font-medium">{controle.responsavel_nome}</span>
              </div>
            )}
            {controle.frequencia && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconActivity className="h-4 w-4" />
                <span>{capitalizeText(controle.frequencia)}</span>
              </div>
            )}
            {controle.proxima_avaliacao && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IconCalendar className="h-4 w-4" />
                <span>{formatDateOnly(controle.proxima_avaliacao)}</span>
              </div>
            )}
            {controle.categoria && (
              <Badge 
                variant="outline" 
                style={{ borderColor: controle.categoria.cor, color: controle.categoria.cor }}
              >
                {controle.categoria.nome}
              </Badge>
            )}
          </div>

          {/* Descrição separada com suporte a quebras de linha e scroll */}
          {controle.descricao?.trim() && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
                <IconFile className="h-4 w-4" />
                {t('controlesAuditorias.cddDescricao')}
              </h4>
              <ScrollArea className="max-h-[200px]">
                <div className="bg-card rounded-lg p-4 border border-border/50">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {controle.descricao}
                  </p>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="comentarios" className="mt-4">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="comentarios" className="flex items-center gap-2">
                <IconMessage className="h-4 w-4" />
                {t('controlesAuditorias.cddTabComentarios', { count: comentarios?.length || 0 })}
              </TabsTrigger>
              <TabsTrigger value="evidencias" className="flex items-center gap-2">
                <IconAttach className="h-4 w-4" />
                {t('controlesAuditorias.cddTabEvidencias', { count: evidencias?.length || 0 })}
              </TabsTrigger>
              <TabsTrigger value="auditorias" className="flex items-center gap-2">
                <IconLink className="h-4 w-4" />
                {t('controlesAuditorias.cddTabAuditorias', { count: auditoriasVinculadas?.length || 0 })}
              </TabsTrigger>
              <TabsTrigger value="testes" className="flex items-center gap-2">
                <IconTest className="h-4 w-4" strokeWidth={1.5} />
                {t('t4.testes.tab', { count: testesControle?.length || 0 })}
              </TabsTrigger>
              <TabsTrigger value="requisitos" className="flex items-center gap-2">
                <IconShield className="h-4 w-4" />
                {t('vinculoReq.tabRequisitos', { count: requisitosLigados?.length || 0 })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comentarios" className="flex flex-col space-y-4">
              {/* Input de novo comentário com menções */}
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder={t('controlesAuditorias.cddCommentPlaceholder')}
                    value={novoComentario}
                    onChange={handleCommentChange}
                    rows={2}
                    className="w-full pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 h-6 w-6 p-0"
                    onClick={() => {
                      setNovoComentario(prev => prev + "@");
                      setMentionSearch("");
                      setShowMentions(true);
                      textareaRef.current?.focus();
                    }}
                    title={t('controlesAuditorias.cddMentionTitle')}
                  >
                    <IconMail className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  
                  {/* Dropdown de menções - renderizado via Portal */}
                  <Popover open={showMentions && filteredUsers && filteredUsers.length > 0} onOpenChange={setShowMentions}>
                    <PopoverTrigger asChild>
                      <span className="absolute bottom-0 left-0 w-0 h-0" />
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-64 p-0" 
                      align="start" 
                      side="bottom"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      {filteredUsers?.map((user) => (
                        <button
                          key={user.user_id}
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 text-sm first:rounded-t-md last:rounded-b-md"
                          onClick={() => insertMention(user)}
                        >
                          <IconPerson className="h-4 w-4 text-muted-foreground" />
                          <span>{user.nome}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  onClick={handleAddComentario}
                  disabled={!novoComentario.trim() || isSubmittingComment}
                  aria-label={t('controlesAuditorias.cddCommentSend')}
                  className="self-end"
                >
                  {isSubmittingComment ? (
                    <AkurisPulse size={16} />
                  ) : (
                    <IconSend className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Lista de comentários */}
              <ScrollArea className="min-h-[150px] max-h-[300px]">
                <div className="space-y-3 pr-4">
                  {comentarios?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {t('controlesAuditorias.cddNoComments')}
                    </p>
                  ) : (
                    comentarios?.map((c) => (
                      <div
                        key={c.id}
                        className="bg-card rounded-lg p-3 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <IconPerson className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{c.user_nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleString("pt-BR")}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setDeleteTarget({ type: "comentario", id: c.id })}
                            >
                              <IconDelete className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {renderCommentWithMentions(c.comentario)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="evidencias" className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Upload de evidência */}
              <div className="flex-shrink-0 mb-4">
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUploadEvidencia}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <AkurisPulse size={20} className="text-muted-foreground" />
                  ) : (
                    <IconUpload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isUploading ? t('controlesAuditorias.cddUploadingLabel') : t('controlesAuditorias.cddUploadLabel')}
                  </span>
                </label>
              </div>

              {/* Lista de evidências */}
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {evidencias?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {t('controlesAuditorias.cddNoEvidencias')}
                    </p>
                  ) : (
                    evidencias?.map((ev) => (
                      <div
                        key={ev.link_id}
                        className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <IconFile className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.nome}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(ev.arquivo_tamanho || 0)}</span>
                              <span>•</span>
                              <span>{formatDateOnly(ev.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownload(ev)}
                            title={t('controlesAuditorias.cddDownloadTitle')}
                          >
                            <IconDownload className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDeleteTarget({ type: "evidencia", id: ev.link_id })}
                            title={t('controlesAuditorias.cddDeleteTitle')}
                          >
                            <IconDelete className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="auditorias" className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-4">
                  {auditoriasVinculadas?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {t('controlesAuditorias.cddNoAuditorias')}
                    </p>
                  ) : (
                    auditoriasVinculadas?.map((av: any) => (
                      <div
                        key={av.auditoria_id}
                        className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <IconLink className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{av.auditoria?.nome}</span>
                        </div>
                        <Badge variant="outline">
                          {capitalizeText(av.auditoria?.status?.replace(/_/g, ' ') || '')}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="testes" className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">
                  <TestesList controleId={controle.id} controleNome={controle.nome} />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="requisitos" className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex justify-end mb-3">
                <Button variant="outline" size="sm" onClick={() => setVincularOpen(true)}>
                  <IconLink className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  {t('vinculoReq.gerirLigacoes')}
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-4">
                  {(requisitosLigados?.length || 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {t('vinculoReq.semRequisitosControlo')}
                    </p>
                  ) : (
                    requisitosLigados?.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 p-3 bg-card rounded-lg border border-border/50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.codigo && <span className="font-mono text-micro text-muted-foreground">{r.codigo}</span>}
                            <span className="text-sm font-medium truncate">{r.titulo}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{r.framework_nome}</span>
                        </div>
                        <StatusBadge {...resolveConformityTone(r.conformity_status)}>
                          {getStatusLabel(conformidadeRequisito({ conformity_status: r.conformity_status } as never))}
                        </StatusBadge>

                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

        </div>
      </DialogShell>

      <VincularRequisitoControleDialog
        open={vincularOpen}
        onOpenChange={setVincularOpen}
        controleId={controle.id}
        controleNome={controle.nome}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "evidencia" ? t('controlesAuditorias.cddDeleteEvidenciaTitle') : t('controlesAuditorias.cddDeleteComentarioTitle')}
        description={deleteTarget?.type === "evidencia" 
          ? t('controlesAuditorias.cddDeleteEvidenciaDescription')
          : t('controlesAuditorias.cddDeleteComentarioDescription')
        }
        confirmText={t('controlesAuditorias.cddDeleteConfirm')}
        cancelText={t('controlesAuditorias.cddDeleteCancel')}
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget?.type === "evidencia") {
            handleDeleteEvidencia(deleteTarget.id);
          } else if (deleteTarget) {
            handleDeleteComentario(deleteTarget.id);
          }
        }}
      />
    </>
  );
}
