import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconAttach,
  IconDelete,
  IconDownload,
  IconUpload,
} from "@/components/icons";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";
import { openStorageFile } from "@/lib/storage";
import { formatDateOnly } from "@/lib/date-utils";
import { toast } from "@/lib/toast";

const BUCKET = "dados-documentos";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function SolicitacaoAnexos({
  solicitacao,
  readOnly = false,
}: {
  solicitacao: any;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("evidencia");
  const [busy, setBusy] = useState(false);
  const key = ["solicitacao-anexos", solicitacao.id, empresaId];
  const { data: anexos = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!empresaId && !!solicitacao.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dados_solicitacao_anexos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("solicitacao_id", solicitacao.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const upload = async (file: File) => {
    if (!empresaId) return;
    if (file.size > MAX_SIZE)
      return toast.error(t("privacidadePrograma.anexos.tamanho"));
    if (file.type && !ALLOWED.has(file.type))
      return toast.error(t("privacidadePrograma.anexos.formato"));
    setBusy(true);
    const caminho = `${empresaId}/solicitacoes/${solicitacao.id}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_")}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: auth } = await supabase.auth.getUser();
      try {
        await exigirEscrita(
          (supabase as any).from("dados_solicitacao_anexos").insert({
            empresa_id: empresaId,
            solicitacao_id: solicitacao.id,
            nome_arquivo: file.name,
            caminho,
            mime_type: file.type || null,
            tamanho: file.size,
            categoria,
            uploaded_by: auth.user?.id || null,
          }),
        );
      } catch (cause) {
        await supabase.storage.from(BUCKET).remove([caminho]);
        throw cause;
      }
      await (supabase as any).from("dados_solicitacao_eventos").insert({
        empresa_id: empresaId,
        solicitacao_id: solicitacao.id,
        tipo: "anexo",
        descricao: t("privacidadePrograma.anexos.evento", {
          nome: file.name,
        }),
        created_by: auth.user?.id || null,
      });
      toast.success(t("privacidadePrograma.anexos.enviado"));
      await qc.invalidateQueries({ queryKey: key });
    } catch (cause: any) {
      toast.error(t("privacidadePrograma.anexos.erro"), {
        description: cause?.message,
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const apagar = async (item: any) => {
    if (!empresaId) return;
    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([item.caminho]);
      if (error) throw error;
      await exigirLinhas(
        (supabase as any)
          .from("dados_solicitacao_anexos")
          .delete()
          .eq("id", item.id)
          .eq("empresa_id", empresaId)
          .select("id"),
      );
      toast.success(t("privacidadePrograma.anexos.removido"));
      await qc.invalidateQueries({ queryKey: key });
    } catch (cause: any) {
      toast.error(t("privacidadePrograma.anexos.erro"), {
        description: cause?.message,
      });
    }
  };

  const exportar = () => {
    const pacote = {
      protocolo: solicitacao.id,
      direito: solicitacao.tipo_solicitacao,
      solicitado_em:
        solicitacao.recebida_em ||
        solicitacao.data_solicitacao ||
        solicitacao.created_at,
      concluido_em: solicitacao.data_resposta,
      status: solicitacao.status,
      pedido: solicitacao.dados_solicitados,
      resposta: solicitacao.resposta_titular,
    };
    const blob = new Blob([JSON.stringify(pacote, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `solicitacao-${solicitacao.id}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            {t("privacidadePrograma.anexos.titulo")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("privacidadePrograma.anexos.descricao")}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={exportar}>
          <IconDownload className="mr-2 h-4 w-4" />
          {t("privacidadePrograma.anexos.exportar")}
        </Button>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["identidade", "pedido", "evidencia", "resposta"].map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`privacidadePrograma.anexos.categorias.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx"
            onChange={(e) =>
              e.target.files?.[0] && void upload(e.target.files[0])
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <IconUpload className="mr-2 h-4 w-4" />
            {t("privacidadePrograma.anexos.adicionar")}
          </Button>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("privacidadePrograma.comum.carregando")}
        </p>
      ) : anexos.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconAttach className="h-4 w-4" />
          {t("privacidadePrograma.anexos.vazio")}
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {anexos.map((item: any) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.nome_arquivo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`privacidadePrograma.anexos.categorias.${item.categoria}`)}{" "}
                  · {formatDateOnly(item.created_at)}
                </p>
              </div>
              <div className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("privacidadePrograma.anexos.baixar")}
                  onClick={() => void openStorageFile(BUCKET, item.caminho)}
                >
                  <IconDownload className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={t("common.delete")}
                    onClick={() => void apagar(item)}
                  >
                    <IconDelete className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
