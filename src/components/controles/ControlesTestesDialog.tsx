import { useState, useEffect } from "react";
import { IconClose, IconChecklist, IconAttach } from '@/components/icons';
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserSelect } from "@/components/riscos/UserSelect";
import { proximaDataPorFrequencia, frequenciaLabel } from "@/lib/controle-testes";
import { logger } from "@/lib/logger";

interface ControleTeste {
  id: string;
  controle_id: string;
  data_teste: string;
  resultado: string;
  observacoes?: string;
  evidencias?: string;
  testador?: string;
  testador_id?: string | null;
  evidencia_url?: string | null;
  evidencia_nome?: string | null;
  proxima_avaliacao?: string;
}

interface ControlesTestesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controle: { id: string; nome: string } | null;
  teste?: ControleTeste | null;
}

export default function ControlesTestesDialog({ open, onOpenChange, controle, teste }: ControlesTestesDialogProps) {
  const emptyForm = {
    data_teste: new Date().toISOString().split('T')[0],
    resultado: "eficaz",
    observacoes: "",
    evidencias: "",
    testador: "",
    testador_id: "",
    evidencia_url: "",
    evidencia_nome: "",
    proxima_avaliacao: "",
  };
  const [formData, setFormData] = useState(emptyForm);
  const [isDirty, setIsDirty] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: controleInfo } = useQuery({
    queryKey: ['controle-frequencia', controle?.id],
    enabled: !!controle?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from('controles').select('frequencia').eq('id', controle!.id).maybeSingle();
      return data;
    },
  });
  const frequencia = controleInfo?.frequencia || null;

  useEffect(() => {
    if (teste) {
      setFormData({
        data_teste: teste.data_teste || new Date().toISOString().split('T')[0],
        resultado: teste.resultado || "eficaz",
        observacoes: teste.observacoes || "",
        evidencias: teste.evidencias || "",
        testador: teste.testador || "",
        testador_id: teste.testador_id || "",
        evidencia_url: teste.evidencia_url || "",
        evidencia_nome: teste.evidencia_nome || "",
        proxima_avaliacao: teste.proxima_avaliacao || "",
      });
    } else {
      setFormData(emptyForm);
    }
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teste, open]);

  const update = (patch: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  /** A próxima data prevista deriva da frequência do controlo, mas continua editável. */
  const handleDataTeste = (value: string) => {
    const sugerida = proximaDataPorFrequencia(value, frequencia);
    setFormData(prev => ({
      ...prev,
      data_teste: value,
      proxima_avaliacao: sugerida ?? prev.proxima_avaliacao,
    }));
    setIsDirty(true);
  };

  useEffect(() => {
    if (!open || teste || !frequencia || formData.proxima_avaliacao) return;
    const sugerida = proximaDataPorFrequencia(formData.data_teste, frequencia);
    if (sugerida) setFormData(prev => ({ ...prev, proxima_avaliacao: sugerida }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequencia, open]);

  const handleUpload = async (file: File) => {
    if (!controle) return;
    setUploading(true);
    try {
      const path = `${controle.id}/testes/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('controles-evidencias').upload(path, file);
      if (error) throw error;
      update({ evidencia_url: path, evidencia_nome: file.name });
    } catch (error: any) {
      logger.error('Falha ao anexar evidência de teste', { error: error?.message, module: 'controles' });
      toast({ title: t('t4.testes.anexoErro'), description: error?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const saveTesteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!controle) throw new Error(t('controlesAuditorias.ctdErrorControleNotFound'));
      const { data: userData } = await supabase.auth.getUser();

      const testeData = {
        controle_id: controle.id,
        data_teste: data.data_teste || null,
        resultado: data.resultado,
        observacoes: data.observacoes || null,
        evidencias: data.evidencias || null,
        testador: data.testador || null,
        testador_id: data.testador_id || null,
        evidencia_url: data.evidencia_url || null,
        evidencia_nome: data.evidencia_nome || null,
        proxima_avaliacao: data.proxima_avaliacao || null,
      };

      if (teste) {
        const { error } = await supabase.from('controles_testes').update(testeData).eq('id', teste.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('controles_testes')
          .insert([{ ...testeData, created_by: userData.user?.id ?? null }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_testes'] });
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      queryClient.invalidateQueries({ queryKey: ['controles-stats'] });
      toast({
        title: teste ? t('controlesAuditorias.ctdToastUpdatedTitle') : t('controlesAuditorias.ctdToastCreatedTitle'),
        description: teste ? t('controlesAuditorias.ctdToastUpdatedDesc') : t('controlesAuditorias.ctdToastCreatedDesc'),
      });
      setIsDirty(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('controlesAuditorias.ctdErrorTitle'),
        description: t('controlesAuditorias.ctdErrorSaveDesc', { action: teste ? t('controlesAuditorias.ctdActionUpdate') : t('controlesAuditorias.ctdActionCreate'), message: error.message }),
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.data_teste || !formData.resultado) {
      toast({
        title: t('controlesAuditorias.ctdErrorTitle'),
        description: t('controlesAuditorias.ctdValidationRequired'),
        variant: "destructive",
      });
      return;
    }
    saveTesteMutation.mutate(formData);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={IconChecklist}
      title={teste ? t('controlesAuditorias.ctdTitleEdit') : t('controlesAuditorias.ctdTitleNew')}
      description={controle?.nome}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={teste ? t('controlesAuditorias.ctdSubmitUpdate') : t('controlesAuditorias.ctdSubmitCreate')}
      isSubmitting={saveTesteMutation.isPending}
      isDirty={isDirty}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="data_teste">{t('t4.testes.campoData')}</Label>
            <DateField
              id="data_teste"
              value={formData.data_teste || null}
              onChange={(v) => handleDataTeste(v || '')}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultado">{t('t4.testes.campoResultado')}</Label>
            <Select value={formData.resultado} onValueChange={(value) => update({ resultado: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eficaz">{t('t4.testes.resultado.eficaz')}</SelectItem>
                <SelectItem value="parcialmente_eficaz">{t('t4.testes.resultado.parcialmente_eficaz')}</SelectItem>
                <SelectItem value="ineficaz">{t('t4.testes.resultado.ineficaz')}</SelectItem>
                <SelectItem value="nao_aplicavel">{t('t4.testes.resultado.nao_aplicavel')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('t4.testes.campoTestador')}</Label>
            <UserSelect
              value={formData.testador_id}
              onValueChange={(value) => update({ testador_id: value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxima_avaliacao">{t('t4.testes.campoProxima')}</Label>
            <DateField
              id="proxima_avaliacao"
              value={formData.proxima_avaliacao || null}
              onChange={(v) => update({ proxima_avaliacao: v || '' })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {frequencia
                ? t('t4.testes.proximaAuto', { frequencia: frequenciaLabel(frequencia, t) })
                : t('t4.testes.proximaSemFrequencia')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">{t('t4.testes.campoObservacoes')}</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => update({ observacoes: e.target.value })}
            placeholder={t('controlesAuditorias.ctdFieldObservacoesPlaceholder')}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="evidencias">{t('t4.testes.campoEvidencia')}</Label>
          <Textarea
            id="evidencias"
            value={formData.evidencias}
            onChange={(e) => update({ evidencias: e.target.value })}
            placeholder={t('t4.testes.campoEvidenciaNota')}
            rows={2}
          />
          {formData.evidencia_nome ? (
            <div className="flex items-center gap-2 text-sm">
              <IconAttach className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="truncate">{formData.evidencia_nome}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t('t4.testes.removerAnexo')}
                onClick={() => update({ evidencia_url: '', evidencia_nome: '' })}
              >
                <IconClose className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Input
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          )}
        </div>
      </div>
    </DialogShell>
  );
}
