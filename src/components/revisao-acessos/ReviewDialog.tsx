import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DialogShell } from "@/components/ui/dialog-shell";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReviewData } from "@/hooks/useReviewData";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useQuery } from '@tanstack/react-query';
import { QueryError } from '@/components/ui/query-error';
import { readAllPages } from '@/lib/read-all-pages';
import { supabase } from "@/integrations/supabase/client";
import { parseDateForDB, formatarDiaParaDB} from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconView } from '@/components/icons';


const buildReviewSchema = (t: (key: string) => string) => z.object({
  nome_revisao: z.string().trim().min(3, t('experience.reviewNameRequired')),
  descricao: z.string().optional(),
  tipo_revisao: z.enum(["periodica", "ad_hoc", "recertificacao"]),
  sistema_id: z.string().uuid(t('experience.reviewSystemRequired')),
  responsavel_revisao: z.string().uuid(t('experience.reviewOwnerUnavailable')),
  data_inicio: z.string().min(1, t('experience.reviewDateRequired')),
  data_limite: z.string().min(1, t('experience.reviewDateRequired')),
  observacoes: z.string().optional(),
}).refine(data => !data.data_limite || data.data_limite >= data.data_inicio, { path: ['data_limite'], message: t('experience.reviewDateOrder') });

type ReviewFormData = z.infer<ReturnType<typeof buildReviewSchema>>;

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  review?: any;
  onSuccess: () => void;
}

export function ReviewDialog({ open, onClose, review, onSuccess }: ReviewDialogProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const { createReview, updateReview } = useReviewData();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(buildReviewSchema(t)),
    defaultValues: {
      nome_revisao: "",
      descricao: "",
      tipo_revisao: "periodica",
      sistema_id: "",
      responsavel_revisao: "",
      data_inicio: formatarDiaParaDB(new Date()),
      data_limite: "",
      observacoes: "",
    },
  });

  const systemsQuery = useQuery({
    queryKey: ['review-form-systems', empresaId], enabled: open && !!empresaId,
    queryFn: async ({ signal }) => (await readAllPages((from, to) => supabase.from('sistemas_privilegiados')
      .select('id, nome_sistema').eq('empresa_id', empresaId!).eq('ativo', true)
      .order('nome_sistema').order('id').range(from, to).abortSignal(signal), signal)).data,
  });
  const ownersQuery = useQuery({
    queryKey: ['review-form-owners', empresaId], enabled: open && !!empresaId,
    queryFn: async ({ signal }) => (await readAllPages((from, to) => supabase.from('profiles')
      .select('user_id, nome').eq('empresa_id', empresaId!).eq('ativo', true)
      .order('nome').order('user_id').range(from, to).abortSignal(signal), signal)).data,
  });
  const sistemas = systemsQuery.data ?? [];
  const usuarios = ownersQuery.data ?? [];
  const optionsError = systemsQuery.isError || ownersQuery.isError;
  const optionsLoading = systemsQuery.isLoading || ownersQuery.isLoading;

  useEffect(() => {
    if (review) {
      form.reset({
        nome_revisao: review.nome_revisao,
        descricao: review.descricao || "",
        tipo_revisao: review.tipo_revisao,
        sistema_id: review.sistema_id,
        responsavel_revisao: review.responsavel_revisao,
        data_inicio: review.data_inicio,
        data_limite: review.data_limite,
        observacoes: review.observacoes || "",
      });
    } else {
      form.reset({
        nome_revisao: "",
        descricao: "",
        tipo_revisao: "periodica",
        sistema_id: "",
        responsavel_revisao: "",
        data_inicio: formatarDiaParaDB(new Date()),
        data_limite: "",
        observacoes: "",
      });
    }
  }, [review, form, empresaId]);

  const onSubmit = async (data: ReviewFormData) => {
    try {
      const payload = {
        ...data,
        data_inicio: parseDateForDB(data.data_inicio),
        data_limite: parseDateForDB(data.data_limite),
      };

      if (review) {
        await updateReview(review.id, payload);
      } else {
        await createReview(payload);
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar revisão:", error);
      // The mutation shows a mapped, localized error and keeps this form open.
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={review?.id ? t("revisaoAcessosComp.reviewDialog.titleEdit") : t("revisaoAcessosComp.reviewDialog.titleNew")}
        icon={IconView}
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel={review ? t("revisaoAcessosComp.reviewDialog.submitUpdate") : t("revisaoAcessosComp.reviewDialog.submitCreate")}
        isDirty={form.formState.isDirty}
        isSubmitting={form.formState.isSubmitting}
        submitDisabled={optionsError || optionsLoading || !empresaId || (!review && (!sistemas.length || !usuarios.length))}
        submitBlockedReason={!optionsLoading && !optionsError && !review && (!sistemas.length || !usuarios.length) ? t('experience.reviewSetupMissing') : undefined}
      >
<Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t(review ? 'experience.reviewScopeFrozen' : 'experience.reviewPopulation')}</p>
            {optionsError && <QueryError onRetry={() => { void systemsQuery.refetch(); void ownersQuery.refetch(); }} />}
            <FormField
              control={form.control}
              name="nome_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldNome")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("revisaoAcessosComp.reviewDialog.fieldNomePlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldDescricao")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="tipo_revisao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldTipo")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="periodica">{t("revisaoAcessosComp.reviewDialog.tipoPeriodica")}</SelectItem>
                        <SelectItem value="ad_hoc">{t("revisaoAcessosComp.reviewDialog.tipoAdHoc")}</SelectItem>
                        <SelectItem value="recertificacao">{t("revisaoAcessosComp.reviewDialog.tipoRecertificacao")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sistema_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldSistema")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!review}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("revisaoAcessosComp.reviewDialog.fieldSistemaPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sistemas?.map((sistema) => (
                          <SelectItem key={sistema.id} value={sistema.id}>
                            {sistema.nome_sistema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="responsavel_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldResponsavel")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("revisaoAcessosComp.reviewDialog.fieldResponsavelPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usuarios?.map((usuario) => (
                        <SelectItem key={usuario.user_id} value={usuario.user_id}>
                          {usuario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldDataInicio")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_limite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldDataLimite")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("revisaoAcessosComp.reviewDialog.fieldObservacoes")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </DialogShell>
  );
}
