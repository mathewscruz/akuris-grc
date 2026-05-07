import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOptimizedQuery } from "@/hooks/useOptimizedQuery";
import { useReviewData } from "@/hooks/useReviewData";
import { supabase } from "@/integrations/supabase/client";
import { formatDateForInput } from "@/lib/date-utils";
import { formatStatus } from "@/lib/text-utils";
import { CheckCircle, XCircle, Edit, Download } from "lucide-react";
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
        title: "Atenção",
        description: `Ainda existem ${pendentes} item(ns) pendente(s) de revisão.`,
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
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pendente: { variant: "outline", label: "Pendente" },
      aprovar: { variant: "secondary", label: "Aprovado" },
      revogar: { variant: "destructive", label: "Revogado" },
      modificar: { variant: "default", label: "Modificado" },
    };
    const config = variants[decisao] || variants.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{review?.nome_revisao} - Itens da Revisão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">Progresso da Revisão</p>
                <p className="text-2xl font-bold">
                  {review?.contas_revisadas}/{review?.total_contas}
                </p>
              </div>
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {progress.toFixed(0)}% concluído
                </p>
              </div>
              <div className="flex gap-2">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                  <p className="text-lg font-semibold text-green-600">
                    {review?.contas_aprovadas || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Revogados</p>
                  <p className="text-lg font-semibold text-red-600">
                    {review?.contas_revogadas || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Buscar por usuário ou email..."
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
                Finalizar Revisão
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
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
                        <Badge>{item.tipo_acesso}</Badge>
                        <Badge variant="outline">{item.nivel_privilegio}</Badge>
                        {getDecisionBadge(item.decisao)}
                      </div>
                      {item.data_expiracao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Expira: {formatDateForInput(item.data_expiracao)}
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
                          Revisar
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredItems?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum item encontrado
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
