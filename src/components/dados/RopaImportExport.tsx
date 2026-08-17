import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { exportRopaWorkbook, parseRopaWorkbook, toRopaPayload } from "@/lib/ropa-planilha";
import { normalizeRopaLabel } from "@/lib/ropa-schema";

interface Props {
  registos: any[];
  onImported: () => void;
}

export function RopaImportExport({ registos, onImported }: Props) {
  const { t, locale } = useLanguage();
  const lang = String(locale).startsWith("en") ? "en" : "pt";
  const { empresaId } = useEmpresaId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [exercicioId, setExercicioId] = useState<string>("none");
  const [exercicios, setExercicios] = useState<any[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    void (async () => {
      const { data } = await supabase
        .from("ropa_exercicios")
        .select("id, nome, versao")
        .eq("empresa_id", empresaId)
        .order("data_realizacao", { ascending: false });
      setExercicios(data || []);
    })();
  }, [empresaId]);

  const handleExport = () => {
    if (registos.length === 0) {
      toast.info(t("dadosDashboard.ropaPlanilha.semRegistos"));
      return;
    }
    exportRopaWorkbook(registos, lang as "pt" | "en", `ROPA_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const handleFile = async (file: File) => {
    if (!empresaId) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseRopaWorkbook(buffer);
      if (parsed.length === 0) {
        toast.error(t("dadosDashboard.ropaPlanilha.nadaEncontrado"));
        return;
      }

      const { data: perfis } = await supabase
        .from("profiles")
        .select("user_id, nome, email")
        .eq("empresa_id", empresaId);

      const resolveUser = (name: string) => {
        const norm = normalizeRopaLabel(name);
        const match = (perfis || []).find(
          (p: any) => normalizeRopaLabel(p.nome || "") === norm || normalizeRopaLabel(p.email || "") === norm,
        );
        return match?.user_id ?? null;
      };

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const rows = parsed.map((record) => ({
        ...toRopaPayload(record.valores, resolveUser),
        empresa_id: empresaId,
        created_by: user?.id ?? null,
        status: "ativo",
        exercicio_id: exercicioId === "none" ? null : exercicioId,
      }));


      const { error } = await supabase.from("ropa_registros").insert(rows as any);
      if (error) throw error;

      toast.success(t("dadosDashboard.ropaPlanilha.importadoSucesso", { count: rows.length }));
      onImported();
    } catch (error: any) {
      logger.error("Falha ao importar planilha ROPA", error);
      toast.error(t("dadosDashboard.ropaPlanilha.erroImportar"), { description: error?.message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {exercicios.length > 0 ? (
        <Select value={exercicioId} onValueChange={setExercicioId}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder={t("dadosDashboard.ropaPlanilha.semExercicio")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("dadosDashboard.ropaPlanilha.semExercicio")}</SelectItem>
            {exercicios.map((ex) => (
              <SelectItem key={ex.id} value={ex.id}>
                {ex.nome}
                {ex.versao ? ` · ${ex.versao}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <input
        ref={inputRef}

        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        {t("dadosDashboard.ropaPlanilha.importar")}
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" />
        {t("dadosDashboard.ropaPlanilha.exportar")}
      </Button>
    </div>
  );
}
