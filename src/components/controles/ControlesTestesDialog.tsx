
import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface ControleTeste {
  id: string;
  controle_id: string;
  data_teste: string;
  resultado: string;
  observacoes?: string;
  evidencias?: string;
  testador?: string;
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
    proxima_avaliacao: ""
  };
  const [formData, setFormData] = useState(emptyForm);
  const [isDirty, setIsDirty] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  useEffect(() => {
    if (teste) {
      setFormData({
        data_teste: teste.data_teste || new Date().toISOString().split('T')[0],
        resultado: teste.resultado || "eficaz",
        observacoes: teste.observacoes || "",
        evidencias: teste.evidencias || "",
        testador: teste.testador || "",
        proxima_avaliacao: teste.proxima_avaliacao || ""
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

  const saveTesteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!controle) throw new Error(t('controlesAuditorias.ctdErrorControleNotFound'));

      const testeData = {
        ...data,
        controle_id: controle.id,
        data_teste: data.data_teste || null,
        proxima_avaliacao: data.proxima_avaliacao || null
      };

      if (teste) {
        const { error } = await supabase
          .from('controles_testes')
          .update(testeData)
          .eq('id', teste.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('controles_testes')
          .insert([testeData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles_testes'] });
      toast({
        title: teste ? t('controlesAuditorias.ctdToastUpdatedTitle') : t('controlesAuditorias.ctdToastCreatedTitle'),
        description: teste ? t('controlesAuditorias.ctdToastUpdatedDesc') : t('controlesAuditorias.ctdToastCreatedDesc'),
      });
      setIsDirty(false);
      onOpenChange(false);
    },
    onError: (error) => {
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
      icon={ClipboardCheck}
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
          <div>
            <Label htmlFor="data_teste">{t('controlesAuditorias.ctdFieldDataTeste')}</Label>
            <DateField
              id="data_teste"
              value={formData.data_teste || null}
              onChange={(v) => update({ data_teste: v || '' })}
              clearable={false}
            />
          </div>

          <div>
            <Label htmlFor="resultado">{t('controlesAuditorias.ctdFieldResultado')}</Label>
            <Select value={formData.resultado} onValueChange={(value) => update({ resultado: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eficaz">{t('controlesAuditorias.ctdResultadoEficaz')}</SelectItem>
                <SelectItem value="ineficaz">{t('controlesAuditorias.ctdResultadoIneficaz')}</SelectItem>
                <SelectItem value="parcialmente_eficaz">{t('controlesAuditorias.ctdResultadoParcial')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="testador">{t('controlesAuditorias.ctdFieldTestador')}</Label>
            <Input
              id="testador"
              value={formData.testador}
              onChange={(e) => update({ testador: e.target.value })}
              placeholder={t('controlesAuditorias.ctdFieldTestadorPlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="proxima_avaliacao">{t('controlesAuditorias.ctdFieldProximaAvaliacao')}</Label>
            <DateField
              id="proxima_avaliacao"
              value={formData.proxima_avaliacao || null}
              onChange={(v) => update({ proxima_avaliacao: v || '' })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="observacoes">{t('controlesAuditorias.ctdFieldObservacoes')}</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => update({ observacoes: e.target.value })}
            placeholder={t('controlesAuditorias.ctdFieldObservacoesPlaceholder')}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="evidencias">{t('controlesAuditorias.ctdFieldEvidencias')}</Label>
          <Textarea
            id="evidencias"
            value={formData.evidencias}
            onChange={(e) => update({ evidencias: e.target.value })}
            placeholder={t('controlesAuditorias.ctdFieldEvidenciasPlaceholder')}
            rows={2}
          />
        </div>
      </div>
    </DialogShell>
  );
}
