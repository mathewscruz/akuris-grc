import { useRef, useState } from "react";
import { IconDelete, IconDownload, IconUpload, IconAttach } from '@/components/icons';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { openStorageFile } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { formatDateOnly } from "@/lib/date-utils";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { EmptyState } from "@/components/ui/empty-state";

const BUCKET = "dados-documentos";

export const uploadRopaAnexo = async (params: {
  empresaId: string;
  exercicioId: string;
  file: File;
  tipo: string;
}) => {
  const { empresaId, exercicioId, file, tipo } = params;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `${empresaId}/ropa-exercicios/${exercicioId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(caminho, file, { upsert: false });
  if (upErr) throw upErr;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("ropa_exercicio_anexos").insert({
    exercicio_id: exercicioId,
    empresa_id: empresaId,
    tipo,
    nome_arquivo: file.name,
    caminho,
    mime_type: file.type || null,
    tamanho: file.size,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw error;
};

const formatSize = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function RopaExercicioAnexos({ exercicioId }: { exercicioId: string }) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("relatorio_executivo");
  const [busy, setBusy] = useState(false);

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ["ropa-exercicio-anexos", exercicioId, empresaId],
    enabled: !!exercicioId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ropa_exercicio_anexos")
        .select("*")
        .eq("exercicio_id", exercicioId)
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ropa-exercicio-anexos", exercicioId, empresaId] });

  const handleFile = async (file: File) => {
    if (!empresaId) return;
    setBusy(true);
    try {
      await uploadRopaAnexo({ empresaId, exercicioId, file, tipo });
      toast.success(t("dadosDashboard.ropaExercicios.anexoCarregado"));
      refresh();
    } catch (error: any) {
      logger.error("Erro ao carregar anexo do exercício ROPA", { data: error });
      toast.error(t("dadosDashboard.ropaExercicios.erroAnexo"), { description: error?.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (anexo: any) => {
    if (!empresaId) return;
    try {
      await supabase.storage.from(BUCKET).remove([anexo.caminho]);
      const { error } = await supabase
        .from("ropa_exercicio_anexos")
        .delete()
        .eq("id", anexo.id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      toast.success(t("dadosDashboard.ropaExercicios.anexoRemovido"));
      refresh();
    } catch (error: any) {
      logger.error("Erro ao remover anexo do exercício ROPA", { data: error });
      toast.error(t("dadosDashboard.ropaExercicios.erroAnexo"), { description: error?.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relatorio_executivo">{t("dadosDashboard.ropaExercicios.tipos.relatorio_executivo")}</SelectItem>
            <SelectItem value="planilha">{t("dadosDashboard.ropaExercicios.tipos.planilha")}</SelectItem>
            <SelectItem value="evidencia">{t("dadosDashboard.ropaExercicios.tipos.evidencia")}</SelectItem>
          </SelectContent>
        </Select>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <IconUpload className="mr-2 h-4 w-4" />
          {t("dadosDashboard.ropaExercicios.carregarAnexo")}
        </Button>
      </div>

      {isLoading ? (
        <AkurisPulse />
      ) : anexos.length === 0 ? (
        <EmptyState
          icon={<IconAttach className="h-8 w-8" />}
          title={t("dadosDashboard.ropaExercicios.semAnexosTitulo")}
          description={t("dadosDashboard.ropaExercicios.semAnexosDescricao")}
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {anexos.map((anexo: any) => (
            <li key={anexo.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{anexo.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`dadosDashboard.ropaExercicios.tipos.${anexo.tipo}`)} · {formatSize(anexo.tamanho)} ·{" "}
                  {formatDateOnly(anexo.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await openStorageFile(BUCKET, anexo.caminho);
                    if (!ok) toast.error(t("dadosDashboard.ropaExercicios.erroAbrirAnexo"));
                  }}
                >
                  <IconDownload className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(anexo)}>
                  <IconDelete className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
