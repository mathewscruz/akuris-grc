import { useEffect, useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { UserSelect } from "@/components/riscos/UserSelect";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { IconChecklist } from '@/components/icons';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercicio?: any;
  onSaved: (id: string) => void;
}

const emptyForm = {
  nome: "",
  versao: "",
  data_realizacao: new Date().toISOString().slice(0, 10),
  periodo_inicio: "",
  periodo_fim: "",
  responsavel_id: "",
  dpo_id: "",
  escopo: "",
  metodologia: "",
  status: "em_curso",
  conclusoes: "",
};

export function RopaExercicioDialog({ open, onOpenChange, exercicio, onSaved }: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [form, setForm] = useState<Record<string, any>>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      exercicio
        ? {
            nome: exercicio.nome || "",
            versao: exercicio.versao || "",
            data_realizacao: exercicio.data_realizacao || new Date().toISOString().slice(0, 10),
            periodo_inicio: exercicio.periodo_inicio || "",
            periodo_fim: exercicio.periodo_fim || "",
            responsavel_id: exercicio.responsavel_id || "",
            dpo_id: exercicio.dpo_id || "",
            escopo: exercicio.escopo || "",
            metodologia: exercicio.metodologia || "",
            status: exercicio.status || "em_curso",
            conclusoes: exercicio.conclusoes || "",
          }
        : emptyForm,
    );
  }, [open, exercicio]);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!empresaId) return;
    if (!form.nome.trim()) {
      toast.error(t("dadosDashboard.ropaExercicios.nomeObrigatorio"));
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        nome: form.nome.trim(),
        versao: form.versao || null,
        data_realizacao: form.data_realizacao || new Date().toISOString().slice(0, 10),
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        responsavel_id: form.responsavel_id || null,
        dpo_id: form.dpo_id || null,
        escopo: form.escopo || null,
        metodologia: form.metodologia || null,
        status: form.status,
        conclusoes: form.conclusoes || null,
        empresa_id: empresaId,
      };

      if (exercicio?.id) {
        const { error } = await supabase
          .from("ropa_exercicios")
          .update(payload)
          .eq("id", exercicio.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        toast.success(t("dadosDashboard.ropaExercicios.atualizado"));
        onSaved(exercicio.id);
      } else {
        const { data, error } = await supabase
          .from("ropa_exercicios")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        toast.success(t("dadosDashboard.ropaExercicios.criado"));
        onSaved(data.id);
      }
      onOpenChange(false);
    } catch (error: any) {
      logger.error("Erro ao guardar exercício ROPA", { data: error });
      toast.error(t("dadosDashboard.ropaExercicios.erroGuardar"), { description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={exercicio?.id ? t("dadosDashboard.ropaExercicios.editarTitulo") : t("dadosDashboard.ropaExercicios.novoTitulo")}
      description={t("dadosDashboard.ropaExercicios.dialogDescricao")}
      icon={IconChecklist}
      size="lg"
      onSubmit={handleSave}
      isSubmitting={saving}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ropa-ex-nome">{t("dadosDashboard.ropaExercicios.campoNome")}</Label>
            <Input id="ropa-ex-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ropa-ex-versao">{t("dadosDashboard.ropaExercicios.campoVersao")}</Label>
            <Input id="ropa-ex-versao" value={form.versao} onChange={(e) => set("versao", e.target.value)} placeholder="v1.0" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoData")}</Label>
            <DateField value={form.data_realizacao} onChange={(v) => set("data_realizacao", v || "")} />
          </div>
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoPeriodoInicio")}</Label>
            <DateField value={form.periodo_inicio} onChange={(v) => set("periodo_inicio", v || "")} clearable />
          </div>
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoPeriodoFim")}</Label>
            <DateField value={form.periodo_fim} onChange={(v) => set("periodo_fim", v || "")} clearable />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoResponsavel")}</Label>
            <UserSelect value={form.responsavel_id} onValueChange={(v) => set("responsavel_id", v)} />
          </div>
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoDpo")}</Label>
            <UserSelect value={form.dpo_id} onValueChange={(v) => set("dpo_id", v)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ropa-ex-escopo">{t("dadosDashboard.ropaExercicios.campoEscopo")}</Label>
          <Textarea id="ropa-ex-escopo" rows={3} value={form.escopo} onChange={(e) => set("escopo", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ropa-ex-metodologia">{t("dadosDashboard.ropaExercicios.campoMetodologia")}</Label>
          <Textarea id="ropa-ex-metodologia" rows={3} value={form.metodologia} onChange={(e) => set("metodologia", e.target.value)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaExercicios.campoStatus")}</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_curso">{t("dadosDashboard.ropaExercicios.status.em_curso")}</SelectItem>
                <SelectItem value="concluido">{t("dadosDashboard.ropaExercicios.status.concluido")}</SelectItem>
                <SelectItem value="aprovado">{t("dadosDashboard.ropaExercicios.status.aprovado")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ropa-ex-conclusoes">{t("dadosDashboard.ropaExercicios.campoConclusoes")}</Label>
          <Textarea id="ropa-ex-conclusoes" rows={3} value={form.conclusoes} onChange={(e) => set("conclusoes", e.target.value)} />
        </div>
      </div>
    </DialogShell>
  );
}
