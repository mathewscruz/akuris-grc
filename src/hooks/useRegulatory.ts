import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import {
  regulatoryDb as db,
  type AssessmentItem,
} from "@/lib/regulatory/types";
import { readAllPages, readAllPagesByIds } from "@/lib/read-all-pages";
import { CRA_FRAMEWORK_ID } from "@/lib/regulatory/catalog";

export function useRegulatoryWorkspace() {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["regulatory", empresaId, "workspace"],
    enabled: !!empresaId,
    queryFn: async () => {
      const requests = await Promise.all([
        readAllPages((from, to) =>
          db
            .from("products")
            .select("*")
            .eq("empresa_id", empresaId!)
            .order("name")
            .order("id")
            .range(from, to),
        ),
        readAllPages((from, to) =>
          db
            .from("product_versions")
            .select("*")
            .eq("empresa_id", empresaId!)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        readAllPages((from, to) =>
          db
            .from("regulatory_assessments")
            .select("*")
            .eq("empresa_id", empresaId!)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        db
          .from("regulatory_framework_versions")
          .select("*")
          .eq("framework_id", CRA_FRAMEWORK_ID)
          .in("status", ["active", "draft"])
          .order("created_at", { ascending: false })
          .limit(1),
        readAllPages((from, to) =>
          db
            .from("profiles")
            .select("id,user_id,nome")
            .eq("empresa_id", empresaId!)
            .eq("ativo", true)
            .order("nome")
            .order("id")
            .range(from, to),
        ),
      ]);
      for (const request of requests) if (request.error) throw request.error;
      return {
        products: requests[0].data ?? [],
        versions: requests[1].data ?? [],
        assessments: requests[2].data ?? [],
        frameworkVersion: requests[3].data?.[0],
        people: requests[4].data ?? [],
      };
    },
  });
  return {
    ...query,
    empresaId,
    refresh: () =>
      client.invalidateQueries({ queryKey: ["regulatory", empresaId] }),
  };
}
export function useRegulatoryAssessment(
  empresaId: string | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: ["regulatory", empresaId, "assessment", id],
    enabled: !!empresaId && !!id,
    queryFn: async () => {
      const { data: assessment, error } = await db
        .from("regulatory_assessments")
        .select("*")
        .eq("id", id!)
        .eq("empresa_id", empresaId!)
        .single();
      if (error) throw error;
      const { data: items, error: itemsError } = await readAllPages(
        (from, to) =>
          db
            .from("regulatory_assessment_items")
            .select("*")
            .eq("assessment_id", id!)
            .eq("empresa_id", empresaId!)
            .order("id")
            .range(from, to),
      );
      if (itemsError) throw itemsError;
      const ids = (items ?? []).map((i) => i.id);
      const [links, findings, sboms, reporting, history] = await Promise.all([
        readAllPagesByIds(ids, (batch, from, to) =>
          db
            .from("regulatory_evidence_links")
            .select("*")
            .eq("empresa_id", empresaId!)
            .in("item_id", batch)
            .is("removed_at", null)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        readAllPagesByIds(ids, (batch, from, to) =>
          db
            .from("regulatory_findings")
            .select("*")
            .eq("empresa_id", empresaId!)
            .in("item_id", batch)
            .order("created_at")
            .order("id")
            .range(from, to),
        ),
        readAllPages((from, to) =>
          db
            .from("regulatory_sboms")
            .select("*")
            .eq("empresa_id", empresaId!)
            .eq("product_version_id", assessment.product_version_id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        db
          .from("regulatory_reporting_workflows")
          .select("*")
          .eq("empresa_id", empresaId!)
          .eq("assessment_id", id!)
          .order("event_type"),
        db
          .from("regulatory_audit_events")
          .select("*")
          .eq("empresa_id", empresaId!)
          .eq("product_id", assessment.product_id)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(100),
      ]);
      for (const result of [links, findings, sboms, reporting, history])
        if (result.error) throw result.error;
      const actions = await readAllPagesByIds(
        (findings.data ?? []).flatMap((f) =>
          f.action_plan_id ? [f.action_plan_id] : [],
        ),
        (batch, from, to) =>
          db
            .from("planos_acao")
            .select("id,status,titulo,prazo")
            .eq("empresa_id", empresaId!)
            .in("id", batch)
            .order("id")
            .range(from, to),
      );
      if (actions.error) throw actions.error;
      return {
        assessment,
        items: (items ?? []).sort(
          (a, b) =>
            a.snapshot.order - b.snapshot.order ||
            a.snapshot.code.localeCompare(b.snapshot.code),
        ),
        links: links.data ?? [],
        findings: findings.data ?? [],
        sboms: sboms.data ?? [],
        reporting: reporting.data ?? [],
        history: history.data ?? [],
        actions: actions.data,
      };
    },
  });
}
export async function saveRegulatoryResponse(
  item: AssessmentItem,
  values: Pick<AssessmentItem, "notes" | "status" | "owner_id" | "due_on">,
) {
  const { data, error } = await db
    .from("regulatory_assessment_items")
    .update(values)
    .eq("id", item.id)
    .eq("empresa_id", item.empresa_id)
    .eq("revision", item.revision)
    .select("*")
    .single();
  if (error || !data) throw new Error("response_conflict");
  return data;
}
