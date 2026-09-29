import { useQuery } from "@tanstack/react-query";
import {
  regulatoryDb as db,
  type RequirementSnapshot,
} from "@/lib/regulatory/types";
import { useCraText } from "@/hooks/useRegulatoryText";

import { readAllPagesByIds } from "@/lib/read-all-pages";
import { CRA_FRAMEWORK_ID } from "@/lib/regulatory/catalog";

export function RegulatoryMappings({
  controls,
}: {
  controls: RequirementSnapshot["controls"];
}) {
  const { text, locale } = useCraText();
  const ids = controls.map((c) => c.id).sort();
  const query = useQuery({
    queryKey: ["regulatory", "mappings", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const rows = await readAllPagesByIds(ids, (batch, from, to) =>
        db
          .from("control_framework_mappings")
          .select("id,control_id,requirement_id,mapping_strength,mapping_notes")
          .in("control_id", batch)
          .order("id")
          .range(from, to),
      );
      if (rows.error) throw rows.error;
      const reqs = await readAllPagesByIds(
        rows.data.map((r) => r.requirement_id),
        (batch, from, to) =>
          db
            .from("gap_analysis_requirements")
            .select("id,codigo,titulo,titulo_en,framework_id")
            .in("id", batch)
            .neq("framework_id", CRA_FRAMEWORK_ID)
            .order("id")
            .range(from, to),
      );
      if (reqs.error) throw reqs.error;
      const frameworks = await readAllPagesByIds(
        [...new Set(reqs.data.map((r) => r.framework_id))],
        (batch, from, to) =>
          db
            .from("gap_analysis_frameworks")
            .select("id,nome")
            .in("id", batch)
            .order("id")
            .range(from, to),
      );
      if (frameworks.error) throw frameworks.error;
      return rows.data.flatMap((m) => {
        const r = reqs.data.find((r) => r.id === m.requirement_id);
        return r
          ? [
              {
                ...m,
                ...r,
                framework:
                  frameworks.data.find((f) => f.id === r.framework_id)?.nome ??
                  "",
              },
            ]
          : [];
      });
    },
  });
  return (
    <section className="space-y-2 border-t pt-4">
      <h4 className="font-medium">
        {text("regulatory.where_the_same_evidence_may_contribute_8f2186")}
      </h4>
      <p className="text-xs text-muted-foreground">
        {text(
          "regulatory.supporting_mappings_subject_to_review_they_do_no_ec46a9",
        )}
      </p>
      {query.isError ? (
        <p role="alert">{text("regulatory.mappings_unavailable_82387a")}</p>
      ) : query.isPending && ids.length ? (
        <p>{text("regulatory.loading_e47c1c")}</p>
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">
          {text(
            "regulatory.no_supporting_mapping_registered_for_this_contro_bd3bbd",
          )}
        </p>
      ) : (
        <ul className="divide-y">
          {query.data.map((m) => (
            <li key={`${m.control_id}:${m.id}`} className="py-2 text-sm">
              <strong>
                {m.framework} · {m.codigo}
              </strong>
              <p className="text-muted-foreground">
                {locale === "en" && m.titulo_en ? m.titulo_en : m.titulo}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
