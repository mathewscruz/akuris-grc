import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ProductDraft, ProductVersionDraft } from "./models";
import type {
  ApplicabilityAnswers,
  applicabilityStates,
  classificationStates,
} from "./applicability";
import type { ReadinessResponse } from "./readiness-score";
export interface RegulatoryRow {
  id: string;
  empresa_id: string;
  product_id: string;
  created_at: string;
  updated_at: string;
}
export type Product = ProductDraft & {
  id: string;
  empresa_id: string;
  created_at: string;
  updated_at: string;
};
export type ProductVersion = ProductVersionDraft & RegulatoryRow;
export interface Assessment extends RegulatoryRow {
  name: string;
  product_version_id: string;
  framework_version_id: string;
  answers: ApplicabilityAnswers;
  roles: string[];
  preliminary: {
    applicability: string;
    classification: string;
    rules_version: string;
    manufacturer_review: boolean;
  };
  applicability: (typeof applicabilityStates)[number];
  classification: (typeof classificationStates)[number];
  decision_rationale: string;
  status: "in_progress" | "review_ready" | "archived";
  revision: number;
  scope_note: string;
  reviewed_by: string;
  reviewed_at: string;
}
export interface RequirementSnapshot {
  code: string;
  title: string;
  title_en: string;
  domain: string;
  domain_name: string;
  domain_name_en: string;
  description: string;
  description_en: string;
  question: string;
  question_en: string;
  guidance: string;
  guidance_en: string;
  evidence: string;
  evidence_en: string;
  remediation: string;
  remediation_en: string;
  weight: number;
  criticality: "low" | "medium" | "high" | "critical";
  risk: "low" | "medium" | "high" | "critical";
  legal_reference: string;
  source_url: string;
  order: number;
  controls: { id: string; code: string; name: string; strength: string }[];
}
export interface AssessmentItem extends RegulatoryRow {
  assessment_id: string;
  requirement_id: string;
  snapshot: RequirementSnapshot;
  status: ReadinessResponse["status"];
  notes: string;
  owner_id: string | null;
  due_on: string | null;
  revision: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
export interface EvidenceLink extends RegulatoryRow {
  item_id: string;
  evidence_id: string;
  owner_id: string | null;
  evidence_date: string | null;
  valid_until: string | null;
  review_status: "unreviewed" | "accepted" | "rejected";
  comment: string;
  removed_at: string | null;
  analysis_job_id: string | null;
}
export const findingStates = [
  "open",
  "planned",
  "in_progress",
  "pending_evidence",
  "ready_for_review",
  "completed",
  "risk_accepted",
  "resolved",
] as const;
export interface Finding extends RegulatoryRow {
  item_id: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  missing_evidence: string;
  risk: RequirementSnapshot["risk"];
  owner_id: string | null;
  due_on: string | null;
  status: (typeof findingStates)[number];
  decision_note: string;
  department: string;
  action_plan_id: string | null;
  revision: number;
}
export interface Sbom extends RegulatoryRow {
  product_version_id: string;
  evidence_id: string;
  format: "CycloneDX" | "SPDX";
  spec_version: string;
  component_count: number;
  tool: string;
  generated_at: string | null;
  validation_note: string;
  status: "uploaded" | "reviewed" | "superseded";
}
export interface ReportingWorkflow extends RegulatoryRow {
  assessment_id: string;
  event_type: "exploited_vulnerability" | "severe_incident";
  responsible_team: string;
  psirt: string;
  legal_contact: string;
  management_contact: string;
  initial_procedure: string;
  detailed_procedure: string;
  final_procedure: string;
  last_exercise_on: string | null;
  notes: string;
}
export interface AuditEvent extends RegulatoryRow {
  entity_id: string;
  entity_type: string;
  action: string;
  actor_id: string;
  changed_fields: string[];
  old_value: Json;
  new_value: Json;
}
type Table<R> = {
  Row: { [K in keyof R]: R[K] };
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: [];
};
type RegulatoryDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      products: Table<Product>;
      product_versions: Table<ProductVersion>;
      regulatory_assessments: Table<Assessment>;
      regulatory_assessment_items: Table<AssessmentItem>;
      regulatory_evidence_links: Table<EvidenceLink>;
      regulatory_findings: Table<Finding>;
      regulatory_sboms: Table<Sbom>;
      regulatory_reporting_workflows: Table<ReportingWorkflow>;
      regulatory_audit_events: Table<AuditEvent>;
      regulatory_framework_versions: Table<{
        id: string;
        framework_id: string;
        version: string;
        status: string;
        source_url: string;
        coverage_note: string;
      }>;
      control_framework_mappings: Table<{
        id: string;
        control_id: string;
        requirement_id: string;
        framework_version_id: string | null;
        mapping_strength: string;
        mapping_notes: string;
        source_url: string;
        review_status: string;
      }>;
    };
    Functions: Database["public"]["Functions"] & {
      regulatory_create_action: {
        Args: {
          p_finding: string;
          p_title: string;
          p_description: string;
          p_owner: string | null;
          p_due: string | null;
        };
        Returns: string;
      };
      regulatory_readiness: { Args: { p_assessment: string }; Returns: Json };
    };
  };
};
/** One authenticated client/session. No second client, admin key or generated legacy-type rewrite. */
export const regulatoryDb =
  supabase as unknown as SupabaseClient<RegulatoryDatabase>;
