import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Edit, MessageSquare, Send, Trash2, User, Calendar, AtSign, Shield, Activity, Link2, FileText, Paperclip, Upload, Download } from 'lucide-react';
import { toast } from "sonner";
import { formatDateOnly } from "@/lib/date-utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { capitalizeText, formatStatus } from "@/lib/text-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveControleStatusTone, resolveCriticidadeTone } from "@/lib/status-tone";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
import { EvidenceLinksPanel } from '@/components/evidencias/EvidenceLinksPanel';
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
  const [novoComentario, setNovoComentario] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "evidencia" | "comentario"; id: string } | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        user_nome: userMap.get(c.user_id) || "Usuário"
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

  // Buscar evidências
  const { data: evidencias, refetch: refetchEvidencias } = useQuery({
    queryKey: ["controle-evidencias", controle?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controles_evidencias")
        .select("*")
        .eq("controle_id", controle.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
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
        for (const userId of mencoes) {
          // Notificação in-app
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "Você foi mencionado",
            message: `Você foi mencionado em um comentário no controle "${controle.nome}"`,
            type: "info",
            link_to: `/controles?detalhe=${controle.id}`,
          });

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
      toast.success("Comentário adicionado");
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar comentário");
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
      toast.success("Comentário removido");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover comentário");
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
      toast.error("Tipo de arquivo não permitido. Use PDF, DOC, DOCX, XLS, XLSX, PNG ou JPG.");
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const fileName = `${controle.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("controles-evidencias")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("controles-evidencias")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("controles_evidencias").insert({
        controle_id: controle.id,
        nome: file.name,
        arquivo_url: urlData.publicUrl,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        arquivo_tipo: file.type,
        created_by: userData.user?.id,
      });

      if (insertError) throw insertError;

      refetchEvidencias();
      toast.success("Evidência anexada com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // Deletar evidência
  const handleDeleteEvidencia = async (evidenciaId: string) => {
    try {
      const { error } = await supabase
        .from("controles_evidencias")
        .delete()
        .eq("id", evidenciaId);

      if (error) throw error;

      refetchEvidencias();
      toast.success("Evidência removida");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover evidência");
    }
    setDeleteTarget(null);
  };

  // Download de evidência
  const handleDownload = async (evidencia: any) => {
    if (evidencia.arquivo_url) {
      window.open(evidencia.arquivo_url, "_blank");
    }
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
        icon={Shield}
        size="lg"
        hideFooter
        disableShortcuts
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                {capitalizeText(controle.tipo)}
              </Badge>
              <StatusBadge size="md" {...resolveCriticidadeTone(controle.criticidade)}>
                {formatStatus(controle.criticidade)}
              </StatusBadge>
              <StatusBadge size="md" {...resolveControleStatusTone(controle.status)}>
                {formatStatus(controle.status)}
              </StatusBadge>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>

          {/* Metadados do controle - linha separada */}
          <div className="flex-shrink-0 flex flex-wrap gap-4 items-center text-sm bg-muted/30 rounded-lg p-3">
            {controle.responsavel_nome && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">{controle.responsavel_nome}</span>
              </div>
            )}
            {controle.frequencia && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>{capitalizeText(controle.frequencia)}</span>
              </div>
            )}
            {controle.proxima_avaliacao && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
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
          {controle.descricao && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Descrição
              </h4>
              <ScrollArea className="max-h-[200px]">
                <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
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
                <MessageSquare className="h-4 w-4" />
                Comentários ({comentarios?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="evidencias" className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Evidências ({evidencias?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="auditorias" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Auditorias ({auditoriasVinculadas?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comentarios" className="flex flex-col mt-4 space-y-4">
              {/* Input de novo comentário com menções */}
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Adicione um comentário... Use @ para mencionar alguém"
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
                    title="Mencionar usuário"
                  >
                    <AtSign className="h-4 w-4 text-muted-foreground" />
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
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm first:rounded-t-md last:rounded-b-md"
                          onClick={() => insertMention(user)}
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{user.nome}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  onClick={handleAddComentario}
                  disabled={!novoComentario.trim() || isSubmittingComment}
                  className="self-end"
                >
                  {isSubmittingComment ? (
                    <AkurisPulse size={16} />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Lista de comentários */}
              <ScrollArea className="min-h-[150px] max-h-[300px]">
                <div className="space-y-3 pr-4">
                  {comentarios?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum comentário ainda
                    </p>
                  ) : (
                    comentarios?.map((c) => (
                      <div
                        key={c.id}
                        className="bg-muted/30 rounded-lg p-3 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
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
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
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

            <TabsContent value="evidencias" className="flex-1 overflow-hidden flex flex-col mt-4">
              {/* Biblioteca central de evidências (reaproveitável entre módulos) */}
              {controle?.id && (
                <div className="flex-shrink-0 mb-4 pb-4 border-b border-border">
                  <EvidenceLinksPanel modulo="controles" registroId={controle.id} />
                </div>
              )}

              {/* Anexos específicos deste controle */}
              <p className="flex-shrink-0 text-xs font-medium text-muted-foreground mb-2">Anexos deste controle</p>
              {/* Upload de evidência */}
              <div className="flex-shrink-0 mb-4">
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
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
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isUploading ? "Enviando..." : "Clique para anexar evidência (PDF, DOC, XLS, PNG, JPG)"}
                  </span>
                </label>
              </div>

              {/* Lista de evidências */}
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {evidencias?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma evidência anexada
                    </p>
                  ) : (
                    evidencias?.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.nome}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(ev.arquivo_tamanho || 0)}</span>
                              <span>•</span>
                              <span>{new Date(ev.created_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownload(ev)}
                            title="Baixar"
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setDeleteTarget({ type: "evidencia", id: ev.id })}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="auditorias" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-4">
                  {auditoriasVinculadas?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Este controle não está vinculado a nenhuma auditoria
                    </p>
                  ) : (
                    auditoriasVinculadas?.map((av: any) => (
                      <div
                        key={av.auditoria_id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
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
          </Tabs>
        </div>
      </DialogShell>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "evidencia" ? "Excluir Evidência" : "Excluir Comentário"}
        description={deleteTarget?.type === "evidencia" 
          ? "Tem certeza que deseja excluir esta evidência? Esta ação não pode ser desfeita."
          : "Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita."
        }
        confirmText="Excluir"
        cancelText="Cancelar"
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
