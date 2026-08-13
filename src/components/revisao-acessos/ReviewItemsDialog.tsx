import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { useReviewData } from "@/hooks/useReviewData";
import { supabase } from "@/integrations/supabase/client";
import { formatDateForInput } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { CheckCircle, XCircle, Edit, Download, ClipboardCheck } from "lucide-react";
import { ReviewItemDecisionDialog } from "./ReviewItemDecisionDialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ReviewItemsDialogProps {
  open: boolean;
  onClose: () => void;
  review: any;
  onSuccess: () => void;
}

export function ReviewItemsDialog({ open, onClose, review, onSuccess }: ReviewItemsDialogProps) {
  const { finalizeReview } = useReviewData();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: items,
    loading,
    refetch,
  } = useOptimizedQuery(
    async () => {
      if (!review?.id) return { data: [], error: null };

      const { data, error } = await supabase
        .from("access_review_items")
        .select("*")
        .eq("review_id", review.id)
        .order("usuario_beneficiario");

      return { data: data || [], error };
    },
    [review?.id],
    { cacheKey: `review-items-${review?.id}` }
  );

  const handleDecision = (item: any) => {
    setSelectedItem(item);
    setDecisionDialogOpen(true);
  };

  const handleFinalize = async () => {
    if (!review?.id) return;

    const pendentes = items?.filter((i) => i.decisao === "pendente").length || 0;
    if (pendentes > 0) {
      toast({
        title: t("revisaoAcessosComp.itemsDialog.toastAtencaoTitle"),
        description: t("revisaoAcessosComp.itemsDialog.toastPendentes").replace("{count}", String(pendentes)),
        variant: "destructive",
      });
      return;
    }

    try {
      await finalizeReview(review.id);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao finalizar revisão:", error);
    }
  };

  const getDecisionBadge = (decisao: string) => {
    const variants: Record<string, { tone: StatusTone; label: string }> = {
      pendente: { tone: "neutral", label: t("revisaoAcessosComp.itemsDialog.decisaoPendente") },
      aprovar: { tone: "success", label: t("revisaoAcessosComp.itemsDialog.decisaoAprovado") },
      revogar: { tone: "destructive", label: t("revisaoAcessosComp.itemsDialog.decisaoRevogado") },
      modificar: { tone: "info", label: t("revisaoAcessosComp.itemsDialog.decisaoModificado") },
    };
    const config = variants[decisao] || variants.pendente;
    return <StatusBadge size="sm" tone={config.tone}>{config.label}</StatusBadge>;
  };

  const filteredItems = searchTerm
    ? items?.filter((item) =>
        item.usuario_beneficiario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email_beneficiario?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : items;

  const progress = review?.total_contas > 0
    ? (review.contas_revisadas / review.total_contas) * 100
    : 0;

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        icon={ClipboardCheck}
        title={t("revisaoAcessosComp.itemsDialog.title").replace("{nome}", review?.nome_revisao ?? '')}
        size="xl"
        hideFooter
      >
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{t("revisaoAcessosComp.itemsDialog.progressoTitle")}</p>
                <p className="text-2xl font-bold">
                  {review?.contas_revisadas}/{review?.total_contas}
                </p>
              </div>
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {t("revisaoAcessosComp.itemsDialog.concluido").replace("{pct}", progress.toFixed(0))}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{t("revisaoAcessosComp.itemsDialog.aprovados")}</p>
                  <p className="text-lg font-semibold text-success">
                    {review?.contas_aprovadas || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{t("revisaoAcessosComp.itemsDialog.revogados")}</p>
                  <p className="text-lg font-semibold text-destructive">
                    {review?.contas_revogadas || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder={t("revisaoAcessosComp.itemsDialog.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleFinalize}
                disabled={review?.contas_revisadas !== review?.total_contas}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("revisaoAcessosComp.itemsDialog.buttonFinalizar")}
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("revisaoAcessosComp.itemsDialog.buttonExportar")}
              </Button>
            </div>

            <div className="space-y-4">
              {filteredItems?.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.usuario_beneficiario}</h4>
                      <p className="text-sm text-muted-foreground">{item.email_beneficiario || "-"}</p>
                      <div className="flex gap-2 mt-2">
                        <StatusBadge size="sm" tone="neutral">{formatStatus(item.tipo_acesso)}</StatusBadge>
                        <StatusBadge size="sm" tone="neutral" variant="outline">{formatStatus(item.nivel_privilegio)}</StatusBadge>
                        {getDecisionBadge(item.decisao)}
                      </div>
                      {item.data_expiracao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("revisaoAcessosComp.itemsDialog.expira").replace("{data}", formatDateForInput(item.data_expiracao))}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecision(item)}
                    >
                      {item.decisao === "pendente" ? (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          {t("revisaoAcessosComp.itemsDialog.buttonRevisar")}
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          {t("revisaoAcessosComp.itemsDialog.buttonEditar")}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredItems?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {t("revisaoAcessosComp.itemsDialog.emptyItems")}
                </p>
              )}
            </div>
          </div>
      </DialogShell>

      <ReviewItemDecisionDialog
        open={decisionDialogOpen}
        onClose={() => {
          setDecisionDialogOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onSuccess={() => {
          refetch();
          onSuccess();
          setDecisionDialogOpen(false);
          setSelectedItem(null);
        }}
      />
    </>
  );
}
