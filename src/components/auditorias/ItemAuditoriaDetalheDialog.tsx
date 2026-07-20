import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Edit, Paperclip, MessageSquare, Send, Upload, Trash2, User, Calendar, Download, FileText, AtSign } from 'lucide-react';
import { toast } from "sonner";
import { formatDateOnly } from "@/lib/date-utils";
import ConfirmDialog from "@/components/ConfirmDialog";

import { AkurisPulse } from '@/components/ui/AkurisPulse';
interface ItemAuditoriaDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  onSuccess: () => void;
  onEdit: () => void;
}

import { StatusBadge } from "@/components/ui/status-badge";
import { resolveItemAuditoriaStatusTone, resolvePrioridadeTone } from "@/lib/status-tone";
import { formatStatus } from "@/lib/text-utils";

export function ItemAuditoriaDetalheDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
  onEdit,
}: ItemAuditoriaDetalheDialogProps) {
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
    queryKey: ["auditoria-item-comentarios", item?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_itens_comentarios")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const { data: users } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);

      const userMap = new Map(users?.map(u => [u.user_id, u.nome]) || []);
      
      return data?.map(c => ({
        ...c,
        user_nome: userMap.get(c.user_id) || "Usuário"
      })) || [];

    },
    enabled: open && !!item?.id,
  });

  // Buscar evidências
  const { data: evidencias, refetch: refetchEvidencias } = useQuery({
    queryKey: ["auditoria-item-evidencias", item?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria_itens_evidencias")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!item?.id,
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

    // Verificar se está digitando uma menção
    const textBeforeCursor = value.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1);
      // Se não tem espaço depois do @, está buscando uma menção
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

      const { error } = await supabase.from("auditoria_itens_comentarios").insert({
        item_id: item.id,
        user_id: userData.user?.id,
        comentario: novoComentario.trim(),
        mencoes: mencoes.length > 0 ? mencoes : null,
      });

      if (error) throw error;

      // Notificar usuários mencionados
      if (mencoes.length > 0) {
        for (const userId of mencoes) {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "Você foi mencionado",
            message: `Você foi mencionado em um comentário no controle "${item.titulo}"`,
            type: "info",
            link_to: "/auditorias",
          });
        }
      }

      setNovoComentario("");
      refetchComentarios();
      onSuccess();
      toast.success("Comentário adicionado");
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar comentário");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUploadEvidencia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const fileName = `${item.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("auditoria-evidencias")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("auditoria-evidencias")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("auditoria_itens_evidencias").insert({
        item_id: item.id,
        nome: file.name,
        arquivo_url: urlData.publicUrl,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        arquivo_tipo: file.type,
        uploaded_by: userData.user?.id,
      });

      if (insertError) throw insertError;

      refetchEvidencias();
      onSuccess();
      toast.success("Evidência anexada com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteEvidencia = async (evidenciaId: string) => {
    try {
      const { error } = await supabase
        .from("auditoria_itens_evidencias")
        .delete()
        .eq("id", evidenciaId);

      if (error) throw error;

      refetchEvidencias();
      onSuccess();
      toast.success("Evidência removida");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover evidência");
    }
    setDeleteTarget(null);
  };

  const handleDeleteComentario = async (comentarioId: string) => {
    try {
      const { error } = await supabase
        .from("auditoria_itens_comentarios")
        .delete()
        .eq("id", comentarioId);

      if (error) throw error;

      refetchComentarios();
      onSuccess();
      toast.success("Comentário removido");
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover comentário");
    }
    setDeleteTarget(null);
  };

  const handleDownload = async (evidencia: any) => {
    if (evidencia.arquivo_url) {
      window.open(evidencia.arquivo_url, "_blank");
    }
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

  if (!item) return null;

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={item.titulo}
        icon={FileText}
        size="lg"
        hideFooter
        disableShortcuts
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge size="md" tone="neutral" variant="outline" className="font-mono">
                {item.codigo}
              </StatusBadge>
              <StatusBadge size="md" {...resolvePrioridadeTone(item.prioridade)}>
                {formatStatus(item.prioridade)}
              </StatusBadge>
              <StatusBadge size="md" {...resolveItemAuditoriaStatusTone(item.status)}>
                {formatStatus(item.status)}
              </StatusBadge>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>

          {/* Info do item */}
          <div className="flex-shrink-0 bg-muted/50 rounded-lg p-4 space-y-2">
            {item.descricao && (
              <p className="text-sm text-muted-foreground">{item.descricao}</p>
            )}
            <div className="flex gap-4 text-sm">
              {item.responsavel && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{item.responsavel.nome}</span>
                </div>
              )}
              {item.prazo && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Prazo: {formatDateOnly(item.prazo)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="comentarios" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="comentarios" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comentários ({comentarios?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="evidencias" className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Evidências ({evidencias?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comentarios" className="flex-1 overflow-hidden flex flex-col mt-4">
              {/* Input de novo comentário com menções */}
              <div className="flex gap-2 mb-4 flex-shrink-0 relative">
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
                      setShowMentions(true);
                      textareaRef.current?.focus();
                    }}
                    title="Mencionar usuário"
                  >
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  
                  {/* Popover de menções */}
                  {showMentions && filteredUsers && filteredUsers.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 w-64 bg-popover border rounded-md shadow-lg z-50">
                      {filteredUsers.map((user) => (
                        <button
                          key={user.user_id}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 text-sm"
                          onClick={() => insertMention(user)}
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{user.nome}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
              <ScrollArea className="flex-1">
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
              {/* Upload de evidência */}
              <div className="flex-shrink-0 mb-4">
                <label className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <AkurisPulse size={20} />
                        <span>Fazendo upload...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <span>Clique para anexar evidência</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUploadEvidencia}
                    disabled={isUploading}
                  />
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
                    evidencias?.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{e.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.arquivo_tamanho
                                ? `${(e.arquivo_tamanho / 1024).toFixed(1)} KB`
                                : ""}
                              {" • "}
                              {new Date(e.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(e)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: "evidencia", id: e.id })}
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
          </Tabs>
        </div>
      </DialogShell>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={deleteTarget?.type === "evidencia" ? "Remover Evidência" : "Remover Comentário"}
        description={`Tem certeza que deseja remover ${
          deleteTarget?.type === "evidencia" ? "esta evidência" : "este comentário"
        }?`}
        confirmText="Remover"
        onConfirm={() => {
          if (deleteTarget?.type === "evidencia") {
            handleDeleteEvidencia(deleteTarget.id);
          } else if (deleteTarget?.type === "comentario") {
            handleDeleteComentario(deleteTarget.id);
          }
        }}
      />
    </>
  );
}
