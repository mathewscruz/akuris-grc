import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages, readAllPagesByIds } from "@/lib/read-all-pages";
export function EvidenceImpact({ evidenceId }: { evidenceId: string }) {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const links = useQuery({
    queryKey: ["evidence-impact", empresaId, evidenceId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await readAllPages((from, to) => supabase.from("evidence_library_links")
        .select("id,aceito_em,vinculo_tipo,framework_id,requirement_id").eq(
          "empresa_id",
          empresaId!,
        ).eq("evidence_id", evidenceId).order("id").range(from, to));
      if (error) throw error;
      const requirementIds = [
        ...new Set(
          data.map((l) => l.requirement_id).filter((id): id is string => !!id),
        ),
      ];
      const frameworkIds = [
        ...new Set(
          data.map((l) => l.framework_id).filter((id): id is string => !!id),
        ),
      ];
      const [requirements, frameworks] = await Promise.all([
        requirementIds.length
          ? readAllPagesByIds(requirementIds, (ids, from, to) => supabase.from("gap_analysis_requirements").select(
            "id,codigo,titulo",
          ).in("id", ids).order("id").range(from, to))
          : { data: [], error: null },
        frameworkIds.length
          ? readAllPagesByIds(frameworkIds, (ids, from, to) => supabase.from("gap_analysis_frameworks").select("id,nome").in(
            "id",
            ids,
          ).order("id").range(from, to))
          : { data: [], error: null },
      ]);
      if (requirements.error || frameworks.error) {
        throw requirements.error || frameworks.error;
      }
      return data.map((l) => ({
        ...l,
        requirement: requirements.data?.find((r) => r.id === l.requirement_id),
        framework: frameworks.data?.find((f) => f.id === l.framework_id),
      }));
    },
  });
  return (
    <div className="space-y-2 border-t pt-3 text-xs">
      <h4 className="font-medium">
        {t("evidenceIntelligence.evidenceImpact")}
      </h4>
      {links.isPending
        ? <p>…</p>
        : links.isError
        ? <p>{t("evidenceIntelligence.readError")}</p>
        : !links.data?.length
        ? <p>{t("evidenceIntelligence.noLinks")}</p>
        : (
          <ul className="space-y-2">
            {links.data.map((l) => (
              <li key={l.id}>
                {l.framework_id && l.requirement_id
                  ? (
                    <Link
                      className="text-primary hover:underline"
                      to={`/gap-analysis/framework/${l.framework_id}?req=${l.requirement_id}`}
                    >
                      {l.framework?.nome} · {l.requirement?.codigo} —{" "}
                      {l.requirement?.titulo}
                    </Link>
                  )
                  : <span>{t("evidenceIntelligence.linked")}</span>}
                {l.vinculo_tipo === "sugestao_ia" && !l.aceito_em && (
                  <span className="text-muted-foreground">
                    · {t("evidenceIntelligence.pending")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
