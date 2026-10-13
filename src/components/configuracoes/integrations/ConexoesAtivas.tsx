import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatusBadge } from "@/components/ui/status-badge";
import { COLLECTION_PROVIDERS } from "@/lib/integration-platform";
import { formatDateTime } from "@/lib/date-utils";

interface Conexao {
  id: string;
  provider: string;
  name: string | null;
  status: string;
  last_success_at: string | null;
}
interface Execucao {
  id: string;
  connection_id: string;
  status: string;
  finished_at: string | null;
  created_at: string;
  resource_count: number | null;
}

/** Lista as conexões de coleta ativas da empresa (somente leitura). */
export function ConexoesAtivas({ empresaId }: { empresaId: string }) {
  const { t } = useLanguage();
  const { data } = useQuery({
    queryKey: ["conexoes-ativas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: conns, error } = await supabase
        .from("integration_connections")
        .select("id, provider, name, status, last_success_at")
        .eq("empresa_id", empresaId)
        .eq("status", "connected");
      if (error) throw error;
      const { data: runs } = await supabase
        .from("integration_runs")
        .select("id, connection_id, status, finished_at, created_at, resource_count")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(30);
      return { conns: (conns ?? []) as Conexao[], runs: (runs ?? []) as Execucao[] };
    },
  });

  if (!data?.conns.length) return null;

  return (
    <section className="space-y-3" aria-label={t("collectionHub.conectadas.titulo")}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("collectionHub.conectadas.titulo")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {data.conns.map((c) => {
          const prov = COLLECTION_PROVIDERS.find((p) => p.id === c.provider);
          const runs = data.runs.filter((r) => r.connection_id === c.id).slice(0, 3);
          const recursos = runs[0]?.resource_count ?? null;
          return (
            <article key={c.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-center gap-3">
                {prov && (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-white p-2.5">
                    <img src={`/integrations/${prov.logo}`} alt="" className="h-full w-full object-contain" width={28} height={28} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-semibold">{prov?.name ?? c.name ?? c.provider}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t("collectionHub.conectadas.ultimoScan")}: {c.last_success_at ? formatDateTime(c.last_success_at) : "—"}
                  </p>
                </div>
                <StatusBadge tone="success">{t("collectionHub.conectadas.conectado")}</StatusBadge>
              </div>
              {recursos != null && (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">{recursos}</span>{" "}
                  <span className="text-muted-foreground">{t("collectionHub.conectadas.recursos")}</span>
                </p>
              )}
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t("collectionHub.conectadas.historico")}</p>
                {runs.length ? (
                  <ul className="space-y-1 text-xs">
                    {runs.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>{formatDateTime(r.finished_at ?? r.created_at)}</span>
                        <span className="text-muted-foreground">
                          {r.status === "failed" ? t("collectionHub.conectadas.falha") : t("collectionHub.conectadas.sucesso")}
                          {r.resource_count != null ? ` · ${r.resource_count}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("collectionHub.conectadas.nenhum")}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
