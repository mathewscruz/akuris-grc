import { useRef, useState } from "react";
import { IconDownload, IconUpload } from '@/components/icons';
import { Button } from "@/components/ui/button";
;

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { exportRopaWorkbook, parseRopaWorkbook, toRopaPayload } from "@/lib/ropa-planilha";
import { normalizeRopaLabel } from "@/lib/ropa-schema";

import { formatarDiaParaDB } from '@/lib/date-utils';
interface Props {
  registos: any[];
  /**
   * ROPA de destino da importação. Havia aqui um seletor de exercício solto na
   * barra de ferramentas: com a forma de um filtro, ao lado dos outros filtros,
   * mas era o DESTINO da importação — clicar nele não filtrava nada, e ficava
   * quase sempre em "Sem exercício associado", que foi como os sete
   * tratamentos importados acabaram sem ROPA nenhum. Agora o destino é o ROPA
   * que está aberto: não há nada para escolher nem para enganar.
   *
   * `null` — a lista de ROPAs — só exporta.
   */
  exercicioId: string | null;
  onImported: () => void;
}

export function RopaImportExport({ registos, exercicioId, onImported }: Props) {
  const { t, locale } = useLanguage();
  const { empresaId } = useEmpresaId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    if (registos.length === 0) {
      toast.info(t("dadosDashboard.ropaPlanilha.semRegistos"));
      return;
    }
    exportRopaWorkbook(registos, locale, `ROPA_${formatarDiaParaDB(new Date())}.xlsx`);
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
        exercicio_id: exercicioId,
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
      {exercicioId ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <IconUpload className="mr-2 h-4 w-4" />
          {t("dadosDashboard.ropaPlanilha.importar")}
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={handleExport}>
        <IconDownload className="mr-2 h-4 w-4" />
        {t("dadosDashboard.ropaPlanilha.exportar")}
      </Button>
    </div>
  );
}
