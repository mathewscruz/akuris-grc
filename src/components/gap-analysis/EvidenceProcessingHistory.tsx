import { useQuery } from "@tanstack/react-query";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/date-utils";
interface Job {
  id: string;
  status: string;
  updated_at: string;
  lease_until: string;
  reader_version: string;
  requirement: { codigo: string | null; titulo: string } | null;
}
export function EvidenceProcessingHistory() {
  const { empresaId } = useEmpresaId();
  const { t } = useLanguage();
  const jobs = useQuery({
    queryKey: ["evidence-processing-history", empresaId],
    enabled: !!empresaId,
    staleTime: 15000,
    refetchInterval: (query) =>
      query.state.data?.some((j) =>
          j.status === "running" &&
          new Date(j.lease_until).getTime() > Date.now()
        )
        ? 5000
        : false,
    queryFn: async () => {
      const { data, error } = await supabase.from(
        "evidence_analysis_jobs",
      ).select(
        "id,status,updated_at,lease_until,reader_version,requirement:gap_analysis_requirements(codigo,titulo)",
      ).eq(
        "empresa_id",
        empresaId!,
      ).order("updated_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data as unknown as Job[];
    },
  });
  return (
    <details className="rounded-lg border bg-background px-4 py-3 text-xs">
      <summary className="cursor-pointer font-medium">
        {t("evidenceIntelligence.processing.title")}
      </summary>
      <div className="space-y-3 pt-3">
        <p className="text-muted-foreground">
          {t("evidenceIntelligence.processing.hint")}
        </p>
        <Button variant="ghost" size="sm" onClick={() => jobs.refetch()}>
          {t("evidenceIntelligence.refresh")}
        </Button>
        {jobs.isError
          ? <p role="alert">{t("evidenceIntelligence.readError")}</p>
          : jobs.isPending
          ? <p>…</p>
          : !jobs.data.length
          ? <p>{t("evidenceIntelligence.processing.empty")}</p>
          : (
            <ul className="divide-y">
              {jobs.data.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap justify-between gap-2 py-2"
                >
                  <span className="w-full font-medium">
                    {[job.requirement?.codigo, job.requirement?.titulo].filter(
                      Boolean,
                    ).join(" · ") || t("evidenceIntelligence.analysis")}
                  </span>
                  <span>
                    {t(
                      `evidenceIntelligence.processing.${
                        job.status === "running" &&
                          new Date(job.lease_until).getTime() < Date.now()
                          ? "interrupted"
                          : job.status
                      }`,
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateOnly(job.updated_at)} · {job.reader_version}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </details>
  );
}
