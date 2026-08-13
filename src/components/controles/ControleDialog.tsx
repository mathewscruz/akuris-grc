import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveCriticidadeTone } from "@/lib/status-tone";
import { ShieldCheck, Settings2, Link2, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserSelect } from "@/components/riscos/UserSelect";
import { RiscoSelect } from "@/components/controles/RiscoSelect";
import { AuditoriasMultiSelect } from "@/components/controles/AuditoriasMultiSelect";
import { useIntegrationNotify } from "@/hooks/useIntegrationNotify";
import { WizardDialog, WizardTab, WizardTabState } from "@/components/ui/wizard-dialog";
import { WizardSummaryCard, WizardSummaryRow } from "@/components/ui/wizard-summary-card";
import { FieldHelpTooltip } from "@/components/ui/field-help-tooltip";
import { logger } from "@/lib/logger";
import { formatStatus } from '@/lib/text-utils';
import { useLanguage } from '@/contexts/LanguageContext';

const formatDateForDatabase = (dateString: string): string | null => (!dateString ? null : dateString);
const formatDateForInput = (dateString: string | null): string => (!dateString ? '' : dateString.split('T')[0]);

interface Controle {
  id: string;
  codigo?: string;
  nome: string;
  descricao?: string;
  tipo: string;
  categoria_id?: string;
  area?: string;
  responsavel_id?: string;
  frequencia?: string;
  status: string;
  criticidade: string;
  data_implementacao?: string;
  proxima_avaliacao?: string;
}

interface Categoria { id: string; nome: string; cor: string; }

interface ControleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controle: Controle | null;
  categorias: Categoria[];
}

export default function ControleDialog({ open, onOpenChange, controle, categorias }: ControleDialogProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('identificacao');
  const [formData, setFormData] = useState({
    codigo: "", nome: "", descricao: "", tipo: "preventivo", categoria_id: "sem_categoria",
    risco_id: "", area: "", responsavel_id: "", frequencia: "", status: "ativo",
    criticidade: "medio", data_implementacao: "", proxima_avaliacao: "", auditorias_ids: [] as string[],
  });
  const [initialSnapshot, setInitialSnapshot] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { notify } = useIntegrationNotify();

  useEffect(() => {
    if (controle) {
      Promise.all([
        supabase.from('controles_riscos').select('risco_id').eq('controle_id', controle.id).maybeSingle(),
        supabase.from('controles_auditorias').select('auditoria_id').eq('controle_id', controle.id),
      ]).then(([riscoRes, audRes]) => {
        const next = {
          codigo: controle.codigo || "", nome: controle.nome || "", descricao: controle.descricao || "",
          tipo: controle.tipo || "preventivo", categoria_id: controle.categoria_id || "sem_categoria",
          risco_id: riscoRes.data?.risco_id || "", area: controle.area || "",
          responsavel_id: controle.responsavel_id || "", frequencia: controle.frequencia || "",
          status: controle.status || "ativo", criticidade: controle.criticidade || "medio",
          data_implementacao: formatDateForInput(controle.data_implementacao),
          proxima_avaliacao: formatDateForInput(controle.proxima_avaliacao),
          auditorias_ids: audRes.data?.map((i) => i.auditoria_id) || [],
        };
        setFormData(next);
        setInitialSnapshot(JSON.stringify(next));
      });
    } else {
      const blank = {
        codigo: "", nome: "", descricao: "", tipo: "preventivo", categoria_id: "sem_categoria",
        risco_id: "", area: "", responsavel_id: "", frequencia: "", status: "ativo",
        criticidade: "medio", data_implementacao: "", proxima_avaliacao: "", auditorias_ids: [] as string[],
      };
      setFormData(blank);
      setInitialSnapshot(JSON.stringify(blank));
    }
    setActiveTab('identificacao');
  }, [controle, open]);

  const isDirty = JSON.stringify(formData) !== initialSnapshot;
  const update = (patch: Partial<typeof formData>) => setFormData((p) => ({ ...p, ...patch }));

  const saveControleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profile } = await supabase
        .from('profiles').select('empresa_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id).single();
      if (!profile?.empresa_id) throw new Error(t('controlesAuditorias.cdlgErrorEmpresaNotFound'));

      const controleData = {
        codigo: data.codigo?.trim() || null, nome: data.nome, descricao: data.descricao, tipo: data.tipo,
        categoria_id: data.categoria_id === "sem_categoria" ? null : data.categoria_id,
        responsavel_id: data.responsavel_id || null, area: data.area, frequencia: data.frequencia,
        status: data.status, criticidade: data.criticidade,
        data_implementacao: formatDateForDatabase(data.data_implementacao),
        proxima_avaliacao: formatDateForDatabase(data.proxima_avaliacao),
        empresa_id: profile.empresa_id,
      };

      let controleId: string;
      const isNewResponsavel = data.responsavel_id &&
        ((!controle && data.responsavel_id) || (controle && controle.responsavel_id !== data.responsavel_id));

      if (controle) {
        const { error } = await supabase.from('controles').update(controleData).eq('id', controle.id);
        if (error) throw error;
        controleId = controle.id;
      } else {
        const { data: nc, error } = await supabase.from('controles').insert([controleData]).select().single();
        if (error) throw error;
        controleId = nc.id;
      }

      await supabase.from('controles_riscos').delete().eq('controle_id', controleId);
      if (data.risco_id) {
        await supabase.from('controles_riscos').insert([{
          controle_id: controleId, risco_id: data.risco_id, tipo_vinculacao: 'mitigacao',
        }]);
      }

      await supabase.from('controles_auditorias').delete().eq('controle_id', controleId);
      if (data.auditorias_ids.length > 0) {
        await supabase.from('controles_auditorias').insert(
          data.auditorias_ids.map((auditoria_id) => ({ controle_id: controleId, auditoria_id }))
        );
      }

      if (isNewResponsavel && data.responsavel_id) {
        try {
          await supabase.functions.invoke('send-controle-notification', {
            body: {
              controle_id: controleId, controle_nome: data.nome,
              controle_descricao: data.descricao, proxima_avaliacao: data.proxima_avaliacao,
              responsavel_id: data.responsavel_id,
            },
          });
        } catch (e) { logger.error("Failed to send controle notification:", e); }
      }

      await notify(controle ? 'controle_atualizado' : 'controle_criado', {
        titulo: controle ? `Controle atualizado: ${data.nome}` : `Novo controle: ${data.nome}`,
        descricao: data.descricao?.substring(0, 200) || undefined,
        link: `/governanca?tab=controles&controle=${controleId}`,
        gravidade: data.criticidade === 'critico' ? 'alta' : data.criticidade === 'alto' ? 'media' : 'baixa',
        dados: { controle_id: controleId, nome: data.nome, tipo: data.tipo, criticidade: data.criticidade, status: data.status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      toast({ title: controle ? t('controlesAuditorias.cdlgToastUpdated') : t('controlesAuditorias.cdlgToastCreated') });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: t('controlesAuditorias.cdlgErrorTitle'), description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      setActiveTab('identificacao');
      toast({ title: t('controlesAuditorias.cdlgErrorTitle'), description: t('controlesAuditorias.cdlgValidationNomeRequired'), variant: "destructive" });
      return;
    }
    saveControleMutation.mutate(formData);
  };

  // 'complete' só quando campos sem default foram preenchidos pelo usuário.
  // tipo/criticidade/status têm defaults hardcoded — não contam isoladamente.
  const identState: WizardTabState = formData.nome.trim() && formData.codigo.trim() ? 'complete' : (formData.nome.trim() || formData.codigo.trim() ? 'partial' : 'pending');
  const classifState: WizardTabState = formData.frequencia || formData.area.trim() ? 'complete' : 'pending';
  const respState: WizardTabState = formData.responsavel_id ? 'complete' : 'pending';
  const vincState: WizardTabState = formData.risco_id || formData.auditorias_ids.length > 0 ? 'complete' : 'pending';

  const tabs: WizardTab[] = useMemo(() => [
    {
      id: 'identificacao', label: t('controlesAuditorias.cdlgTabIdent'), icon: ShieldCheck, state: identState, hint: t('controlesAuditorias.cdlgTabIdentHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                {t('controlesAuditorias.cdlgFieldCodigo')}
                <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldCodigoHelp')} />
              </Label>
              <Input value={formData.codigo} onChange={(e) => update({ codigo: e.target.value })} placeholder={t('controlesAuditorias.cdlgFieldCodigoPlaceholder')} />
            </div>
            <div className="md:col-span-2">
              <Label className="flex items-center gap-1">
                {t('controlesAuditorias.cdlgFieldNome')} <span className="text-destructive">*</span>
                <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldNomeHelp')} />
              </Label>
              <Input value={formData.nome} onChange={(e) => update({ nome: e.target.value })} placeholder={t('controlesAuditorias.cdlgFieldNomePlaceholder')} required />
            </div>
          </div>
          <div>
            <Label>{t('controlesAuditorias.cdlgFieldDescricao')}</Label>
            <Textarea value={formData.descricao} onChange={(e) => update({ descricao: e.target.value })} rows={6} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t('controlesAuditorias.cdlgFieldArea')}</Label>
              <Input value={formData.area} onChange={(e) => update({ area: e.target.value })} placeholder={t('controlesAuditorias.cdlgFieldAreaPlaceholder')} />
            </div>
            <div>
              <Label>{t('controlesAuditorias.cdlgFieldCategoria')}</Label>
              <Select value={formData.categoria_id || "sem_categoria"} onValueChange={(v) => update({ categoria_id: v === "sem_categoria" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_categoria">{t('controlesAuditorias.cdlgSemCategoria')}</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'classificacao', label: t('controlesAuditorias.cdlgTabClassif'), icon: Settings2, state: classifState, hint: t('controlesAuditorias.cdlgTabClassifHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                {t('controlesAuditorias.cdlgFieldTipo')}
                <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldTipoHelp')} />
              </Label>
              <Select value={formData.tipo} onValueChange={(v) => update({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventivo">{t('controlesAuditorias.cdlgTipoPreventivo')}</SelectItem>
                  <SelectItem value="detectivo">{t('controlesAuditorias.cdlgTipoDetectivo')}</SelectItem>
                  <SelectItem value="corretivo">{t('controlesAuditorias.cdlgTipoCorretivo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('controlesAuditorias.cdlgFieldFrequencia')}</Label>
              <Select value={formData.frequencia} onValueChange={(v) => update({ frequencia: v })}>
                <SelectTrigger><SelectValue placeholder={t('controlesAuditorias.cdlgFrequenciaSelecione')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">{t('controlesAuditorias.cdlgFrequenciaDiaria')}</SelectItem>
                  <SelectItem value="semanal">{t('controlesAuditorias.cdlgFrequenciaSemanal')}</SelectItem>
                  <SelectItem value="mensal">{t('controlesAuditorias.cdlgFrequenciaMensal')}</SelectItem>
                  <SelectItem value="trimestral">{t('controlesAuditorias.cdlgFrequenciaTrimestral')}</SelectItem>
                  <SelectItem value="semestral">{t('controlesAuditorias.cdlgFrequenciaSemestral')}</SelectItem>
                  <SelectItem value="anual">{t('controlesAuditorias.cdlgFrequenciaAnual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('controlesAuditorias.cdlgFieldStatus')}</Label>
              <Select value={formData.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">{t('controlesAuditorias.cdlgStatusAtivo')}</SelectItem>
                  <SelectItem value="inativo">{t('controlesAuditorias.cdlgStatusInativo')}</SelectItem>
                  <SelectItem value="em_revisao">{t('controlesAuditorias.cdlgStatusEmRevisao')}</SelectItem>
                  <SelectItem value="descontinuado">{t('controlesAuditorias.cdlgStatusDescontinuado')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                {t('controlesAuditorias.cdlgFieldCriticidade')}
                <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldCriticidadeHelp')} />
              </Label>
              <Select value={formData.criticidade} onValueChange={(v) => update({ criticidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">{t('controlesAuditorias.cdlgCriticidadeBaixo')}</SelectItem>
                  <SelectItem value="medio">{t('controlesAuditorias.cdlgCriticidadeMedio')}</SelectItem>
                  <SelectItem value="alto">{t('controlesAuditorias.cdlgCriticidadeAlto')}</SelectItem>
                  <SelectItem value="critico">{t('controlesAuditorias.cdlgCriticidadeCritico')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> {t('controlesAuditorias.cdlgFieldImplementacao')}</Label>
              <Input type="date" value={formData.data_implementacao} onChange={(e) => update({ data_implementacao: e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> {t('controlesAuditorias.cdlgFieldProximaAvaliacao')}</Label>
              <Input type="date" value={formData.proxima_avaliacao} onChange={(e) => update({ proxima_avaliacao: e.target.value })} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'responsabilidade', label: t('controlesAuditorias.cdlgTabResp'), icon: Settings2, state: respState, hint: t('controlesAuditorias.cdlgTabRespHint'),
      content: (
        <div className="space-y-5 max-w-2xl">
          <div>
            <Label className="flex items-center gap-1">
              {t('controlesAuditorias.cdlgFieldResponsavel')}
              <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldResponsavelHelp')} />
            </Label>
            <UserSelect
              value={formData.responsavel_id}
              onValueChange={(v) => update({ responsavel_id: v })}
              placeholder={t('controlesAuditorias.cdlgFieldResponsavelPlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t('controlesAuditorias.cdlgResponsavelHint')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'vinculacoes', label: t('controlesAuditorias.cdlgTabVinc'), icon: Link2, state: vincState, hint: t('controlesAuditorias.cdlgTabVincHint'),
      content: (
        <div className="space-y-5 max-w-3xl">
          <div>
            <Label className="flex items-center gap-1">
              {t('controlesAuditorias.cdlgFieldRisco')}
              <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldRiscoHelp')} />
            </Label>
            <RiscoSelect value={formData.risco_id} onValueChange={(v) => update({ risco_id: v })} placeholder={t('controlesAuditorias.cdlgFieldRiscoPlaceholder')} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              {t('controlesAuditorias.cdlgFieldAuditorias')}
              <FieldHelpTooltip content={t('controlesAuditorias.cdlgFieldAuditoriasHelp')} />
            </Label>
            <AuditoriasMultiSelect
              value={formData.auditorias_ids}
              onValueChange={(v) => update({ auditorias_ids: v })}
              placeholder={t('controlesAuditorias.cdlgFieldAuditoriasPlaceholder')}
            />
          </div>
        </div>
      ),
    },
  ], [formData, categorias, identState, classifState, respState, vincState]);

  const summary = (
    <WizardSummaryCard title={t('controlesAuditorias.cdlgSummaryTitle')}>
      <WizardSummaryRow label={t('controlesAuditorias.cdlgSummaryNome')} value={formData.nome || <span className="text-muted-foreground italic">{t('controlesAuditorias.cdlgSummarySemNome')}</span>} highlight />
      <WizardSummaryRow label={t('controlesAuditorias.cdlgSummaryTipo')} value={<span>{formatStatus(formData.tipo)}</span>} />
      <WizardSummaryRow
        label={t('controlesAuditorias.cdlgSummaryCriticidade')}
        value={<StatusBadge size="sm" {...resolveCriticidadeTone(formData.criticidade)}>{formatStatus(formData.criticidade)}</StatusBadge>}
      />
      <WizardSummaryRow label={t('controlesAuditorias.cdlgSummaryStatus')} value={<span>{formatStatus(formData.status)}</span>} />
      <WizardSummaryRow label={t('controlesAuditorias.cdlgSummaryAuditorias')} value={formData.auditorias_ids.length} />
    </WizardSummaryCard>
  );

  return (
    <WizardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={controle ? t('controlesAuditorias.cdlgTitleEdit') : t('controlesAuditorias.cdlgTitleNew')}
      description={t('controlesAuditorias.cdlgDescription')}
      icon={ShieldCheck}
      tabs={tabs}
      summary={summary}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      onSubmit={handleSubmit}
      submitLabel={controle ? t('controlesAuditorias.cdlgSubmitUpdate') : t('controlesAuditorias.cdlgSubmitCreate')}
      isSubmitting={saveControleMutation.isPending}
      submitDisabled={!formData.nome.trim() || saveControleMutation.isPending}
      isDirty={isDirty}
      size="xl"
    />
  );
}
