import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from 'lucide-react';
import { ReviewExternalForm } from "@/components/revisao-acessos/ReviewExternalForm";
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateOnly } from '@/lib/date-utils';

import { AkurisPulse } from '@/components/ui/AkurisPulse';
export default function ReviewExterna() {
  const { token } = useParams<{ token: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const loadReview = async () => {
      if (!token) {
        setError(t('publicPortal.reviewExterna.invalidToken'));
        setLoading(false);
        return;
      }

      try {
        // Buscar revisão pelo token (sem autenticação)
        const { data, error: reviewError } = await supabase
          .from("access_reviews")
          .select(`
            *,
            sistema:sistemas_privilegiados(nome_sistema)
          `)
          .eq("link_token", token)
          .single();

        if (reviewError) throw reviewError;

        if (!data) {
          setError(t('publicPortal.reviewExterna.notFound'));
          setLoading(false);
          return;
        }

        // Verificar se já foi concluída
        if (data.status === "concluida") {
          setCompleted(true);
          setLoading(false);
          return;
        }

        // Verificar se está vencida
        const dataLimite = new Date(data.data_limite);
        if (dataLimite < new Date()) {
          setError(t('publicPortal.reviewExterna.expired'));
          setLoading(false);
          return;
        }

        setReview(data);
        setLoading(false);
      } catch (err: any) {
        logger.error('Erro ao carregar revisão', { module: 'ReviewExterna', error: err.message });
        setError(err.message || t('publicPortal.reviewExterna.loadError'));
        setLoading(false);
      }
    };

    loadReview();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AkurisPulse size={32} className="mx-auto mb-4" />
          <p className="text-muted-foreground">{t('publicPortal.reviewExterna.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full p-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold">{t('publicPortal.reviewExterna.completedTitle')}</h2>
            <p className="text-muted-foreground">
              {t('publicPortal.reviewExterna.completedDescription')}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/akuris-logo.png"
                alt="Akuris"
                className="h-8"
              />
              <h1 className="text-2xl font-bold">{t('publicPortal.reviewExterna.title')}</h1>
            </div>
            <p className="text-muted-foreground">
              {t('publicPortal.reviewExterna.system')} <strong>{review?.sistema?.nome_sistema}</strong>
            </p>
            <p className="text-muted-foreground">
              {t('publicPortal.reviewExterna.deadline')} <strong>{formatDateOnly(review?.data_limite)}</strong>
            </p>
          </div>

          <ReviewExternalForm
            review={review}
            onComplete={() => setCompleted(true)}
          />
        </Card>
      </div>
    </div>
  );
}
