import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { formatDateOnly } from "@/lib/date-utils";
import { readAllPages } from "@/lib/read-all-pages";

interface ReviewEvent {
  id: string;
  kind: string;
  reason: string;
  actor_id: string;
  request_id: string | null;
  valid_until: string | null;
  created_at: string;
}
interface ReviewState {
  reviewed_at: string | null;
  changed: boolean;
  expired: boolean;
  events: ReviewEvent[];
  pending_request?: ReviewEvent | null;
  exception?: {
    valid_until: string;
    reason: string;
    expired: boolean;
    changed: boolean;
  } | null;
}
const eventLabel: Record<string, string> = {
  review: "confirm",
  exception_requested: "request",
  exception_approved: "approve",
  exception_rejected: "reject",
  plan_linked: "plan",
};
export function RequirementReviewPanel(
  { evaluationId, onPlanLinked, hasUnsavedChanges = false }: {
    evaluationId?: string | null;
    onPlanLinked: (id: string) => void | Promise<void>;
    hasUnsavedChanges?: boolean;
  },
) {
  const { empresaId } = useEmpresaId();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const queryKey = ["compliance-review", empresaId, evaluationId];
  const state = useQuery({
    queryKey,
    enabled: !!empresaId && !!evaluationId,
    staleTime: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "compliance_review_state",
        { p_evaluation: evaluationId! },
      );
      if (error) throw error;
      return data as unknown as ReviewState;
    },
  });
  const plans = useQuery({
    queryKey: ["compliance-reusable-plans", empresaId],
    enabled: !!empresaId && !!evaluationId,
    queryFn: async () => {
      const { data, error } = await readAllPages((from, to) => supabase.from("planos_acao").select(
        "id,titulo",
      ).eq("empresa_id", empresaId!).not(
        "status",
        "in",
        "(cancelado,concluido)",
      ).order("updated_at", { ascending: false }).order("id").range(from, to));
      if (error) throw error;
      return data;
    },
  });
  async function record(kind: string, request?: string) {
    if (saving || hasUnsavedChanges) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc(
        "compliance_record_review",
        {
          p_evaluation: evaluationId!,
          p_kind: kind,
          p_reason: reason,
          p_until: until || null,
          p_request: request || null,
          p_plan: plan || null,
        },
      );
      if (error) throw error;
      await client.invalidateQueries({ queryKey });
      if (kind === "plan_linked") await onPlanLinked(plan);
      toast.success(t("evidenceIntelligence.success"));
      setReason("");
    } catch {
      toast.error(t("evidenceIntelligence.error"));
    } finally {
      setSaving(false);
    }
  }
  const pending = state.data?.pending_request;
  const canApprove = ["admin", "super_admin"].includes(profile?.role || "") &&
    pending?.actor_id !== user?.id;
  return (
    <section
      className="rounded-lg border bg-background p-4 space-y-3"
      aria-label={t("evidenceIntelligence.review")}
    >
      <h3 className="text-sm font-semibold">
        {t("evidenceIntelligence.review")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("evidenceIntelligence.reviewHint")}
      </p>
      {!evaluationId
        ? <p className="text-xs">{t("evidenceIntelligence.saveFirst")}</p>
        : (
          <>
            {hasUnsavedChanges && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("evidenceIntelligence.saveChanges")}
              </p>
            )}
            {state.data?.exception && (
              <div className="rounded border p-3 text-xs space-y-1">
                <p className="font-medium">
                  {t(`evidenceIntelligence.${
                    state.data.exception.expired
                      ? "exceptionExpired"
                      : state.data.exception.changed
                      ? "exceptionChanged"
                      : "exceptionActive"
                  }`)} · {formatDateOnly(state.data.exception.valid_until)}
                </p>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {state.data.exception.reason}
                </p>
              </div>
            )}
            <fieldset
              disabled={hasUnsavedChanges || saving}
              className="space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  {state.isPending
                    ? "…"
                    : state.isError
                    ? t("evidenceIntelligence.readError")
                    : state.data?.expired
                    ? t("evidenceIntelligence.expired")
                    : state.data?.changed
                    ? t("evidenceIntelligence.changed")
                    : state.data?.reviewed_at
                    ? `${t("evidenceIntelligence.current")} · ${
                      formatDateOnly(state.data.reviewed_at)
                    }`
                    : t("evidenceIntelligence.none")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => state.refetch()}
                >
                  {t("evidenceIntelligence.update")}
                </Button>
              </div>
              <Label htmlFor="review-reason">
                {t("evidenceIntelligence.reason")}
              </Label>
              <Textarea
                id="review-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={4000}
                rows={3}
              />
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  size="sm"
                  disabled={saving || reason.trim().length < 12 || !state.data}
                  onClick={() => record("review")}
                >
                  {t("evidenceIntelligence.confirm")}
                </Button>
                <div className="space-y-1">
                  <Label htmlFor="review-until" className="text-xs">
                    {t("evidenceIntelligence.until")}
                  </Label>
                  <Input
                    id="review-until"
                    type="date"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || reason.trim().length < 12 || !until ||
                    !!pending || !state.data}
                  onClick={() => record("exception_requested")}
                >
                  {t("evidenceIntelligence.request")}
                </Button>
              </div>
              {pending && (
                <div className="rounded border p-3 space-y-2 text-xs">
                  <p>{pending.reason}</p>
                  <p>
                    {t("evidenceIntelligence.until")}:{" "}
                    {formatDateOnly(pending.valid_until!)}
                  </p>
                  {canApprove
                    ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={saving || reason.trim().length < 12}
                          onClick={() =>
                            record("exception_approved", pending.id)}
                        >
                          {t("evidenceIntelligence.approve")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving || reason.trim().length < 12}
                          onClick={() =>
                            record("exception_rejected", pending.id)}
                        >
                          {t("evidenceIntelligence.reject")}
                        </Button>
                      </div>
                    )
                    : (
                      <p className="text-muted-foreground">
                        {t("evidenceIntelligence.requestByOther")}
                      </p>
                    )}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="reusable-plan" className="text-xs">
                    {t("evidenceIntelligence.plan")}
                  </Label>
                  <select
                    id="reusable-plan"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    <option value="">
                      {t("evidenceIntelligence.selectPlan")}
                    </option>
                    {plans.data?.map((p) => (
                      <option key={p.id} value={p.id}>{p.titulo}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!plan || reason.trim().length < 12 || saving}
                  onClick={() => record("plan_linked")}
                >
                  {t("evidenceIntelligence.plan")}
                </Button>
              </div>
              {plans.isError && (
                <p role="alert" className="text-xs">
                  {t("evidenceIntelligence.readError")}
                </p>
              )}
            </fieldset>
            {!!state.data?.events.length && (
              <details className="text-xs">
                <summary className="cursor-pointer py-2 font-medium">
                  {t("evidenceIntelligence.history")}
                </summary>
                <ol className="max-h-60 overflow-auto space-y-3">
                  {state.data.events.map((e) => (
                    <li key={e.id} className="border-l-2 pl-3">
                      <p className="font-medium">
                        {t(`evidenceIntelligence.${eventLabel[e.kind]}`)} ·{" "}
                        {formatDateOnly(e.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {e.reason}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )}
    </section>
  );
}
