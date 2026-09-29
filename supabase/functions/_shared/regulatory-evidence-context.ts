import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AuthError } from "./auth.ts";

/** Resolve every identifier with the caller's RLS, never with service-role visibility. */
export async function regulatoryEvidenceContext(
  db: SupabaseClient,
  empresa: string,
  itemId: string,
  linkId: string,
) {
  const permission = await db.rpc("usuario_tem_permissao_modulo", {
    p_modulo: "gap-analysis",
    p_acao: "update",
  });
  if (permission.error || !permission.data)
    throw new AuthError("Revisão não permitida", 403);
  const [item, link] = await Promise.all([
    db
      .from("regulatory_assessment_items")
      .select("id,empresa_id,product_id,assessment_id,requirement_id,snapshot")
      .eq("empresa_id", empresa)
      .eq("id", itemId)
      .single(),
    db
      .from("regulatory_evidence_links")
      .select("id,evidence_id,item_id,evidence_date,valid_until")
      .eq("empresa_id", empresa)
      .eq("item_id", itemId)
      .eq("id", linkId)
      .is("removed_at", null)
      .single(),
  ]);
  if (item.error || link.error || !item.data || !link.data)
    throw new AuthError("Evidência ou requisito indisponível", 404);
  const [assessment, evidence] = await Promise.all([
    db
      .from("regulatory_assessments")
      .select(
        "id,product_id,product_version_id,framework_version_id,roles,classification,applicability,status",
      )
      .eq("empresa_id", empresa)
      .eq("id", item.data.assessment_id)
      .single(),
    db
      .from("evidence_library")
      .select("id,arquivo_url,arquivo_nome,arquivo_hash,bucket,valido_ate")
      .eq("empresa_id", empresa)
      .eq("id", link.data.evidence_id)
      .single(),
  ]);
  if (
    assessment.error ||
    evidence.error ||
    !assessment.data ||
    !evidence.data?.arquivo_url ||
    !evidence.data.arquivo_nome ||
    assessment.data.status === "archived"
  )
    throw new AuthError("Escopo ou arquivo indisponível", 404);
  const [product, version] = await Promise.all([
    db
      .from("products")
      .select("id,name,description,product_type,deployment_model")
      .eq("empresa_id", empresa)
      .eq("id", assessment.data.product_id)
      .single(),
    db
      .from("product_versions")
      .select("id,version,release_date,support_ends_on")
      .eq("empresa_id", empresa)
      .eq("product_id", assessment.data.product_id)
      .eq("id", assessment.data.product_version_id)
      .single(),
  ]);
  if (product.error || version.error || !product.data || !version.data)
    throw new AuthError("Produto indisponível", 404);
  const snapshot = item.data.snapshot;
  return {
    requirementId: item.data.requirement_id,
    filePath: evidence.data.arquivo_url,
    fileName: evidence.data.arquivo_nome,
    bucket: evidence.data.bucket || "gap-evidence-library",
    evidenceId: evidence.data.id,
    expectedHash: evidence.data.arquivo_hash,
    requirement: {
      id: item.data.requirement_id,
      codigo: snapshot.code,
      titulo: snapshot.title,
      descricao: snapshot.description,
      orientacao_implementacao: snapshot.guidance,
      exemplos_evidencias: snapshot.evidence,
      regulatory_context: {
        item_id: itemId,
        assessment: assessment.data,
        product: product.data,
        version: version.data,
        legal_reference: snapshot.legal_reference,
        question: snapshot.question,
        evidence_date: link.data.evidence_date,
        valid_until: link.data.valid_until,
        library_valid_until: evidence.data.valido_ate,
        instruction:
          "Readiness support only; human decision required. Assess age/expiry explicitly; never claim certification.",
      },
    },
  };
}
