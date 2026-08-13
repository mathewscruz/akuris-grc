import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";

interface ReviewExternalFormProps {
  review: any;
  onComplete: () => void;
}

export function ReviewExternalForm({ review, onComplete }: ReviewExternalFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
  }, [review.id]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("access_review_items")
        .select("*")
        .eq("review_id", review.id)
        .order("usuario_beneficiario");

      if (error) throw error;

      setItems(data || []);
      setLoading(false);

      // Encontrar primeiro item pendente
      const firstPendingIndex = data?.findIndex((item) => item.decisao === "pendente") || 0;
      setCurrentIndex(firstPendingIndex);
    } catch (error: any) {
      console.error("Erro ao carregar itens:", error);
      toast({
        title: t("revisaoAcessosComp.externalForm.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDecision = async (decisao: "aprovar" | "revogar") => {
    if (decisao === "revogar" && !justificativa.trim()) {
      toast({
        title: t("revisaoAcessosComp.externalForm.toastAtencaoTitle"),
        description: t("revisaoAcessosComp.externalForm.toastJustificativaRevogacao"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const currentItem = items[currentIndex];

      const { error } = await supabase
        .from("access_review_items")
        .update({
          decisao,
          justificativa_revisor: justificativa || `Decisão: ${decisao}`,
          data_revisao: new Date().toISOString(),
        })
        .eq("id", currentItem.id);

      if (error) throw error;

      // Atualizar lista local
      const updatedItems = [...items];
      updatedItems[currentIndex] = {
        ...currentItem,
        decisao,
        justificativa_revisor: justificativa,
      };
      setItems(updatedItems);

      // Limpar justificativa
      setJustificativa("");

      // Verificar se há mais itens pendentes
      const nextPendingIndex = updatedItems.findIndex(
        (item, idx) => idx > currentIndex && item.decisao === "pendente"
      );

      if (nextPendingIndex === -1) {
        // Não há mais pendentes, verificar se todos foram revisados
        const allReviewed = updatedItems.every((item) => item.decisao !== "pendente");
        if (allReviewed) {
          toast({
            title: t("revisaoAcessosComp.externalForm.toastSucessoTitle"),
            description: t("revisaoAcessosComp.externalForm.toastTodosRevisados"),
          });
          // Não finaliza automaticamente, permite que usuário revise
        } else {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        setCurrentIndex(nextPendingIndex);
      }
    } catch (error: any) {
      console.error("Erro ao salvar decisão:", error);
      toast({
        title: t("revisaoAcessosComp.externalForm.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    const pendentes = items.filter((item) => item.decisao === "pendente").length;

    if (pendentes > 0) {
      toast({
        title: t("revisaoAcessosComp.externalForm.toastAtencaoTitle"),
        description: t("revisaoAcessosComp.externalForm.toastPendentes").replace("{count}", String(pendentes)),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke("finalize-review", {
        body: { reviewId: review.id },
      });

      if (error) throw error;

      onComplete();
    } catch (error: any) {
      console.error("Erro ao finalizar:", error);
      toast({
        title: t("revisaoAcessosComp.externalForm.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p>{t("revisaoAcessosComp.externalForm.loading")}</p>;
  }

  const currentItem = items[currentIndex];
  const revisados = items.filter((item) => item.decisao !== "pendente").length;
  const progress = items.length > 0 ? (revisados / items.length) * 100 : 0;
  const allReviewed = items.every((item) => item.decisao !== "pendente");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">
            {t("revisaoAcessosComp.externalForm.progressoLabel").replace("{revisados}", String(revisados)).replace("{total}", String(items.length))}
          </p>
          <p className="text-sm text-muted-foreground">{progress.toFixed(0)}%</p>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {allReviewed ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {t("revisaoAcessosComp.externalForm.allReviewedMsg")}
          </AlertDescription>
        </Alert>
      ) : (
        currentItem && (
          <Card className="p-6 space-y-4 border-2">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-semibold">{currentItem.usuario_beneficiario}</h3>
                {currentItem.email_beneficiario && (
                  <p className="text-sm text-muted-foreground">{currentItem.email_beneficiario}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <StatusBadge size="sm" tone="neutral">{formatStatus(currentItem.tipo_acesso)}</StatusBadge>
                  <StatusBadge size="sm" tone="neutral" variant="outline">{formatStatus(currentItem.nivel_privilegio)}</StatusBadge>
                </div>
              </div>
              <StatusBadge size="sm" tone={currentItem.decisao === "pendente" ? "neutral" : "info"} variant={currentItem.decisao === "pendente" ? "outline" : "soft"}>
                {formatStatus(currentItem.decisao)}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("revisaoAcessosComp.externalForm.dataConcessao")}</p>
                <p className="font-medium">
                  {currentItem.data_concessao ? formatDateForInput(currentItem.data_concessao) : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("revisaoAcessosComp.externalForm.dataExpiracao")}</p>
                <p className="font-medium">
                  {currentItem.data_expiracao ? formatDateForInput(currentItem.data_expiracao) : "-"}
                </p>
              </div>
            </div>

            {currentItem.justificativa_original && (
              <div>
                <p className="text-sm font-medium mb-1">{t("revisaoAcessosComp.externalForm.justificativaOriginal")}</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {currentItem.justificativa_original}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("revisaoAcessosComp.externalForm.justificativaDecisao")} {currentItem.decisao === "revogar" && "*"}
              </label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder={t("revisaoAcessosComp.externalForm.justificativaPlaceholder")}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => handleDecision("aprovar")}
                disabled={submitting}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("revisaoAcessosComp.externalForm.buttonAprovar")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDecision("revogar")}
                disabled={submitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t("revisaoAcessosComp.externalForm.buttonRevogar")}
              </Button>
            </div>
          </Card>
        )
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t("revisaoAcessosComp.externalForm.buttonAnterior")}
        </Button>

        {allReviewed ? (
          <Button onClick={handleFinalize} disabled={submitting} size="lg">
            <CheckCircle className="mr-2 h-4 w-4" />
            {t("revisaoAcessosComp.externalForm.buttonFinalizar")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("revisaoAcessosComp.externalForm.itemXofY").replace("{atual}", String(currentIndex + 1)).replace("{total}", String(items.length))}
          </p>
        )}

        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
          disabled={currentIndex === items.length - 1}
        >
          {t("revisaoAcessosComp.externalForm.buttonProximo")}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
