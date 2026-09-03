
import { useState, useEffect } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconCalendar, IconChecklist } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { dateFnsLocale, formatarDiaParaDB, parseDataLocal } from '@/lib/date-utils';
import { useEmpresaId } from '@/hooks/useEmpresaId';
import type { TablesInsert } from '@/integrations/supabase/types';

interface FrameworkOption {
  id: string;
  nome: string;
  versao: string | null;
  empresa_id: string | null;
  is_template: boolean | null;
}

interface AuditoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoria?: any;
  onSuccess: () => void;
}

const AuditoriaDialog = ({ open, onOpenChange, auditoria, onSuccess }: AuditoriaDialogProps) => {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const [frameworks, setFrameworks] = useState<FrameworkOption[]>([]);
  const [loadingFrameworks, setLoadingFrameworks] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: '',
    status: 'planejamento',
    prioridade: 'media',
    auditor_equipe: [] as string[],
    data_inicio: null as Date | null,
    data_fim_prevista: null as Date | null,
    escopo: '',
    objetivos: '',
    metodologia: '',
    framework: '',
    framework_id: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (auditoria) {
      setFormData({
        nome: auditoria.nome || '',
        descricao: auditoria.descricao || '',
        tipo: auditoria.tipo || '',
        status: auditoria.status || 'planejamento',
        prioridade: auditoria.prioridade || 'media',
        
        auditor_equipe: auditoria.auditor_equipe || [],
        data_inicio: auditoria.data_inicio ? parseDataLocal(auditoria.data_inicio) : null,
        data_fim_prevista: auditoria.data_fim_prevista ? parseDataLocal(auditoria.data_fim_prevista) : null,
        escopo: auditoria.escopo || '',
        objetivos: auditoria.objetivos || '',
        metodologia: auditoria.metodologia || '',
        framework: auditoria.framework || '',
        framework_id: auditoria.framework_id || '',
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        tipo: '',
        status: 'planejamento',
        prioridade: 'media',
        
        auditor_equipe: [],
        data_inicio: null,
        data_fim_prevista: null,
        escopo: '',
        objetivos: '',
        metodologia: '',
        framework: '',
        framework_id: '',
      });
    }
    setErrors({});
  }, [auditoria]);

  useEffect(() => {
    if (!open) return;
    let ativo = true;

    const carregarFrameworks = async () => {
      setLoadingFrameworks(true);
      let query = supabase
        .from('gap_analysis_frameworks')
        .select('id, nome, versao, empresa_id, is_template')
        .order('nome');

      query = empresaId
        ? query.or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        : query.is('empresa_id', null);

      const { data, error } = await query;
      if (!ativo) return;
      if (error) {
        console.error('Erro ao carregar catálogo de frameworks:', error);
        setFrameworks([]);
      } else {
        setFrameworks(((data || []) as FrameworkOption[]).filter((f) => f.empresa_id || f.is_template));
      }
      setLoadingFrameworks(false);
    };

    carregarFrameworks();
    return () => {
      ativo = false;
    };
  }, [empresaId, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = t('controlesAuditorias.adValidationNomeRequired');
    }

    if (!formData.tipo) {
      newErrors.tipo = t('controlesAuditorias.adValidationTipoRequired');
    }

    if (formData.data_inicio && formData.data_fim_prevista) {
      if (formData.data_fim_prevista <= formData.data_inicio) {
        newErrors.data_fim_prevista = t('controlesAuditorias.adValidationDataFim');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * T4 · Gate — uma auditoria não fecha sem trabalho registado, e só fecha com
   * pendências se houver uma razão escrita, que fica gravada no registo.
   */
  const [semItens, setSemItens] = useState(false);
  const [pendencias, setPendencias] = useState<{ itens: number; maiores: number } | null>(null);
  const [razaoConclusao, setRazaoConclusao] = useState('');

  const handleSubmit = async (e: React.FormEvent, razaoGate?: string) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t('controlesAuditorias.adToastFormError'));
      return;
    }

    if (!razaoGate && formData.status === 'concluida' && auditoria?.id && auditoria?.status !== 'concluida') {
      const { data: itens } = await supabase
        .from('auditoria_itens')
        .select('id, status')
        .eq('auditoria_id', auditoria.id);
      const { data: achados } = await supabase
        .from('auditoria_achados')
        .select('id, classificacao, status')
        .eq('auditoria_id', auditoria.id);

      const totalItens = itens?.length || 0;
      if (totalItens === 0) {
        setSemItens(true);
        return;
      }
      const porResolver = (itens || []).filter((i: any) => i.status !== 'concluido').length;
      const maioresAbertas = (achados || []).filter(
        (a: any) => a.classificacao === 'nc_maior' && (a.status || 'aberto') !== 'fechado',
      ).length;

      if (porResolver > 0 || maioresAbertas > 0) {
        setPendencias({ itens: porResolver, maiores: maioresAbertas });
        setRazaoConclusao('');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('controlesAuditorias.adToastNotAuthenticated'));
        setIsSubmitting(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.empresa_id) {
        toast.error(t('controlesAuditorias.adToastCompanyError'));
        setIsSubmitting(false);
        return;
      }

      const auditoriaData: TablesInsert<'auditorias'> = {
        ...formData,
        framework_id: formData.framework_id || null,
        empresa_id: profile.empresa_id,
        data_inicio: formData.data_inicio ? formatarDiaParaDB(formData.data_inicio) : null,
        data_fim_prevista: formData.data_fim_prevista ? formatarDiaParaDB(formData.data_fim_prevista) : null,
      };

      if (razaoGate) {
        auditoriaData.conclusao_forcada = true;
        auditoriaData.conclusao_justificativa = razaoGate;
      }

      if (auditoria) {
        const { error } = await supabase
          .from('auditorias')
          .update(auditoriaData)
          .eq('id', auditoria.id);

        if (error) throw error;
        toast.success(t('controlesAuditorias.adToastUpdated'));
      } else {
        const { error } = await supabase
          .from('auditorias')
          .insert(auditoriaData);

        if (error) throw error;
        toast.success(t('controlesAuditorias.adToastCreated'));
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar auditoria:', error);
      toast.error(t('controlesAuditorias.adToastSaveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={auditoria?.id ? t("controlesAuditorias.adTitleEdit") : t("controlesAuditorias.adTitleNew")}
        icon={IconChecklist}
        size="lg"
        onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
        submitLabel={auditoria ? t('controlesAuditorias.adSubmitUpdate') : t('controlesAuditorias.adSubmitCreate')}
        isSubmitting={isSubmitting}
      >
<form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">{t("controlesAuditorias.adFieldNome")}</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={errors.nome ? "border-destructive" : ""}
              />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">{t("controlesAuditorias.adFieldTipo")}</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger className={errors.tipo ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("controlesAuditorias.adTipoPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">{t("controlesAuditorias.adTipoInterna")}</SelectItem>
                  <SelectItem value="externa">{t("controlesAuditorias.adTipoExterna")}</SelectItem>
                  <SelectItem value="compliance">{t("controlesAuditorias.adTipoCompliance")}</SelectItem>
                  <SelectItem value="operacional">{t("controlesAuditorias.adTipoOperacional")}</SelectItem>
                  <SelectItem value="ti">{t("controlesAuditorias.adTipoTi")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo && <p className="text-sm text-destructive">{errors.tipo}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("controlesAuditorias.adFieldStatus")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejamento">{t("controlesAuditorias.adStatusPlanejamento")}</SelectItem>
                  <SelectItem value="em_andamento">{t("controlesAuditorias.adStatusEmAndamento")}</SelectItem>
                  <SelectItem value="concluida">{t("controlesAuditorias.adStatusConcluida")}</SelectItem>
                  <SelectItem value="cancelada">{t("controlesAuditorias.adStatusCancelada")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioridade">{t("controlesAuditorias.adFieldPrioridade")}</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">{t("controlesAuditorias.adPrioridadeBaixa")}</SelectItem>
                  <SelectItem value="media">{t("controlesAuditorias.adPrioridadeMedia")}</SelectItem>
                  <SelectItem value="alta">{t("controlesAuditorias.adPrioridadeAlta")}</SelectItem>
                  <SelectItem value="critica">{t("controlesAuditorias.adPrioridadeCritica")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="framework">{t("controlesAuditorias.adFieldFramework")}</Label>
              <Select
                value={formData.framework_id || (formData.framework ? `legacy:${formData.framework}` : '')}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setFormData({ ...formData, framework_id: '', framework: 'Personalizado' });
                    return;
                  }
                  if (value.startsWith('legacy:')) return;
                  const framework = frameworks.find((item) => item.id === value);
                  setFormData({
                    ...formData,
                    framework_id: framework?.id || '',
                    framework: framework?.nome || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("controlesAuditorias.adFrameworkPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {formData.framework && !formData.framework_id && formData.framework !== 'Personalizado' && (
                    <SelectItem value={`legacy:${formData.framework}`}>
                      {formData.framework} · {t('controlesAuditorias.adFrameworkLegado')}
                    </SelectItem>
                  )}
                  {loadingFrameworks && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {t('controlesAuditorias.adFrameworkLoading')}
                    </div>
                  )}
                  {!loadingFrameworks && frameworks.map((framework) => (
                    <SelectItem key={framework.id} value={framework.id}>
                      {framework.nome}{framework.versao ? ` · ${framework.versao}` : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{t("controlesAuditorias.adFrameworkPersonalizado")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("controlesAuditorias.adFieldDataInicio")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {formData.data_inicio ? format(formData.data_inicio, "PPP", { locale: dateFnsLocale() }) : t("controlesAuditorias.adSelecioneData")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_inicio || undefined}
                    onSelect={(date) => setFormData({ ...formData, data_inicio: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{t("controlesAuditorias.adFieldDataFim")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-start text-left font-normal ${errors.data_fim_prevista ? "border-destructive" : ""}`}
                  >
                    <IconCalendar className="mr-2 h-4 w-4" />
                    {formData.data_fim_prevista ? format(formData.data_fim_prevista, "PPP", { locale: dateFnsLocale() }) : t("controlesAuditorias.adSelecioneData")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_fim_prevista || undefined}
                    onSelect={(date) => setFormData({ ...formData, data_fim_prevista: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.data_fim_prevista && <p className="text-sm text-destructive">{errors.data_fim_prevista}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">{t("controlesAuditorias.adFieldDescricao")}</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="escopo">{t("controlesAuditorias.adFieldEscopo")}</Label>
            <Textarea
              id="escopo"
              value={formData.escopo}
              onChange={(e) => setFormData({ ...formData, escopo: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetivos">{t("controlesAuditorias.adFieldObjetivos")}</Label>
            <Textarea
              id="objetivos"
              value={formData.objetivos}
              onChange={(e) => setFormData({ ...formData, objetivos: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodologia">{t("controlesAuditorias.adFieldMetodologia")}</Label>
            <Textarea
              id="metodologia"
              value={formData.metodologia}
              onChange={(e) => setFormData({ ...formData, metodologia: e.target.value })}
              rows={3}
            />
          </div>

        </form>

        <AlertDialog open={semItens} onOpenChange={setSemItens}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('t4.gates.auditoriaSemItens')}</AlertDialogTitle>
              <AlertDialogDescription>{t('t4.gates.auditoriaSemItensDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setSemItens(false)}>
                {t('t4.gates.cancelar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!pendencias} onOpenChange={(o) => !o && setPendencias(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('t4.gates.auditoriaPendencias')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('t4.gates.auditoriaPendenciasDesc', {
                  itens: pendencias?.itens ?? 0,
                  maiores: pendencias?.maiores ?? 0,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="razaoConclusao">{t('t4.gates.auditoriaRazao')}</Label>
              <Textarea id="razaoConclusao" rows={3} value={razaoConclusao} onChange={(e) => setRazaoConclusao(e.target.value)} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('t4.gates.cancelar')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={!razaoConclusao.trim()}
                onClick={async (e) => {
                  e.preventDefault();
                  if (!razaoConclusao.trim()) {
                    toast.error(t('t4.gates.auditoriaRazaoObrigatoria'));
                    return;
                  }
                  setPendencias(null);
                  await handleSubmit({ preventDefault: () => {} } as React.FormEvent, razaoConclusao);
                }}
              >
                {t('t4.gates.confirmar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogShell>
  );
};

export default AuditoriaDialog;
