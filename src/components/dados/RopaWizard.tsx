import { useState, useEffect } from "react";
import {
  IconCheck,
  IconChevron,
  IconChecklist,
  IconChevronLeft,
} from "@/components/icons";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { ehDadoSensivel } from "@/lib/jurisdicao";
import { formatStatus } from "@/lib/text-utils";
import { rotuloCategoriaDados } from "@/lib/dados-categorias";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  resolveCriticidadeTone,
  resolveSensibilidadeTone,
} from "@/lib/status-tone";
import { useLanguage } from "@/contexts/LanguageContext";

interface RopaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  preSelectedDadoId?: string;
  /**
   * ROPA a que o tratamento novo pertence. Sem isto, criar um tratamento de
   * dentro de um ROPA gravava-o com `exercicio_id` nulo: o registo aparecia na
   * linha "Tratamentos sem ROPA" e sumia do ROPA onde se carregou no botão.
   */
  exercicioId?: string | null;
}

export function RopaWizard({
  isOpen,
  onClose,
  onSave,
  preSelectedDadoId,
  exercicioId,
}: RopaWizardProps) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const jurisdicao = useJurisdicao();
  const [step, setStep] = useState(1);
  const [selectedDados, setSelectedDados] = useState<string[]>(
    preSelectedDadoId ? [preSelectedDadoId] : [],
  );
  const [selectedAtivos, setSelectedAtivos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    nome_tratamento: "",
    finalidade: "",
    base_legal: "",
    justificativa_base_legal: "",
    abrangencia_base_legal: "",
    categoria_titulares: "",
    prazo_retencao: "",
    medidas_seguranca: "",
    status: "ativo",
  });
  const [dadosPessoais, setDadosPessoais] = useState<any[]>([]);
  const [ativos, setAtivos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * O passo 1 já diz quais dados o tratamento toca — logo o wizard sabe se
   * há dado sensível envolvido e pode oferecer só as bases que a lei admite
   * nesse caso (Art. 11 na LGPD, Art. 9 no RGPD).
   */
  const tocaDadoSensivel = dadosPessoais
    .filter((d) => selectedDados.includes(d.id))
    .some((d) => ehDadoSensivel(d.sensibilidade));

  const basesDisponiveis = jurisdicao.basesLegais(
    tocaDadoSensivel ? "sensivel" : "comum",
  );

  // Voltar ao passo 1 e trocar a seleção pode invalidar a base já escolhida.
  useEffect(() => {
    if (
      formData.base_legal &&
      !basesDisponiveis.some((b) => b.key === formData.base_legal)
    ) {
      setFormData((f) => ({ ...f, base_legal: "" }));
    }
  }, [tocaDadoSensivel]);

  useEffect(() => {
    if (isOpen) {
      loadDados();
      loadAtivos();
    }
  }, [isOpen]);

  const loadDados = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from("dados_pessoais")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome");
    setDadosPessoais(data || []);
  };

  const loadAtivos = async () => {
    if (!empresaId) return;
    const { data } = await supabase
      .from("ativos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome");
    setAtivos(data || []);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      if (!empresaId)
        throw new Error(
          t("dadosDashboard.ropaWizard.errorEmpresaNaoEncontrada"),
        );
      const { error } = await (supabase as any).rpc(
        "criar_tratamento_ropa_completo",
        {
          p_empresa_id: empresaId,
          p_exercicio_id: exercicioId ?? null,
          p_payload: formData,
          p_dados_ids: selectedDados,
          p_ativos_ids: selectedAtivos,
          p_bases: [
            {
              base_legal: formData.base_legal,
              justificativa: formData.justificativa_base_legal,
              abrangencia: formData.abrangencia_base_legal,
            },
          ],
        },
      );
      if (error) throw error;

      toast({
        title: t("dadosDashboard.ropaWizard.toastSuccessTitle"),
        description: t("dadosDashboard.ropaWizard.toastSuccessDescription", {
          count: selectedDados.length,
        }),
      });
      onSave();
      onClose();
      resetWizard();
    } catch (error: any) {
      toast({
        title: t("dadosDashboard.ropaWizard.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedDados(preSelectedDadoId ? [preSelectedDadoId] : []);
    setSelectedAtivos([]);
    setFormData({
      nome_tratamento: "",
      finalidade: "",
      base_legal: "",
      justificativa_base_legal: "",
      abrangencia_base_legal: "",
      categoria_titulares: "",
      prazo_retencao: "",
      medidas_seguranca: "",
      status: "ativo",
    });
  };

  const toggleDado = (id: string) => {
    setSelectedDados((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const toggleAtivo = (id: string) => {
    setSelectedAtivos((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const canProceed = () => {
    if (step === 1) return selectedDados.length > 0;
    if (step === 2)
      return !!(
        formData.nome_tratamento.trim() &&
        formData.finalidade.trim() &&
        formData.base_legal &&
        formData.justificativa_base_legal.trim() &&
        formData.abrangencia_base_legal.trim() &&
        formData.categoria_titulares &&
        formData.prazo_retencao.trim()
      );
    if (step === 3) return true; // Ativos são opcionais
    return false;
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={onClose}
      icon={IconChecklist}
      title={t("dadosDashboard.ropaWizard.dialogTitle")}
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            disabled={isLoading}
          >
            <IconChevronLeft className="h-4 w-4 mr-1" />
            {step === 1
              ? t("dadosDashboard.ropaWizard.buttonCancelar")
              : t("dadosDashboard.ropaWizard.buttonVoltar")}
          </Button>

          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              {t("dadosDashboard.ropaWizard.buttonProximo")}
              <IconChevron className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              <IconCheck className="h-4 w-4 mr-1" />
              {isLoading
                ? t("dadosDashboard.ropaWizard.buttonCriando")
                : t("dadosDashboard.ropaWizard.buttonCriarRopa")}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>{t("dadosDashboard.ropaWizard.stepLabel", { step })}</span>
            <span>{Math.round((step / 4) * 100)}%</span>
          </div>
          <Progress value={(step / 4) * 100} />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                {t("dadosDashboard.ropaWizard.step1Title")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dadosDashboard.ropaWizard.step1Description")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
              {dadosPessoais.map((dado) => (
                <div
                  key={dado.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => toggleDado(dado.id)}
                >
                  <Checkbox checked={selectedDados.includes(dado.id)} />
                  <div className="flex-1">
                    <div className="font-medium">{dado.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {rotuloCategoriaDados(dado.categoria_dados, t)}
                    </div>
                  </div>
                  <StatusBadge
                    {...resolveSensibilidadeTone(dado.sensibilidade)}
                  >
                    {formatStatus(dado.sensibilidade)}
                  </StatusBadge>
                </div>
              ))}
            </div>

            {selectedDados.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedDados.length}{" "}
                {t("dadosDashboard.ropaWizard.step1SelectedSuffix")}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                {t("dadosDashboard.ropaWizard.step2Title")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dadosDashboard.ropaWizard.step2Description")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_tratamento">
                {t("dadosDashboard.ropaWizard.labelNomeTratamento")}
              </Label>
              <Input
                id="nome_tratamento"
                value={formData.nome_tratamento}
                onChange={(e) =>
                  setFormData({ ...formData, nome_tratamento: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.ropaWizard.placeholderNomeTratamento",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="finalidade">
                {t("dadosDashboard.ropaWizard.labelFinalidade")}
              </Label>
              <Textarea
                id="finalidade"
                value={formData.finalidade}
                onChange={(e) =>
                  setFormData({ ...formData, finalidade: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.ropaWizard.placeholderFinalidade",
                )}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base_legal">
                  {t("dadosDashboard.ropaWizard.labelBaseLegal")}
                </Label>
                <Select
                  value={formData.base_legal}
                  onValueChange={(value) =>
                    setFormData({ ...formData, base_legal: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.ropaWizard.placeholderSelecione",
                      )}
                    />
                  </SelectTrigger>
                  {/*
                      As bases legais vêm do mesmo vocabulário do diálogo de
                      edição (`dadosDashboard.common.*`). O wizard tinha uma
                      lista própria com quatro — e é ele o caminho de CRIAÇÃO
                      do ROPA. Quem precisasse de "Proteção da Vida" ou
                      "Políticas Públicas" tinha de gravar uma base errada e
                      corrigir depois no outro formulário. A quarta ainda se
                      chamava "Obrigação Legal" aqui e "Cumprimento de
                      Obrigação Legal" ali, para o mesmo valor gravado.
                    */}
                  <SelectContent>
                    {basesDisponiveis.map((base) => (
                      <SelectItem key={base.key} value={base.key}>
                        {base.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria_titulares">
                  {t("dadosDashboard.ropaWizard.labelCategoriaTitulares")}
                </Label>
                <Select
                  value={formData.categoria_titulares}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoria_titulares: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.ropaWizard.placeholderSelecione",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clientes">
                      {t("dadosDashboard.ropaWizard.categoriaClientes")}
                    </SelectItem>
                    <SelectItem value="funcionarios">
                      {t("dadosDashboard.ropaWizard.categoriaFuncionarios")}
                    </SelectItem>
                    <SelectItem value="fornecedores">
                      {t("dadosDashboard.ropaWizard.categoriaFornecedores")}
                    </SelectItem>
                    <SelectItem value="prospects">
                      {t("dadosDashboard.ropaWizard.categoriaProspects")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="abrangencia_base_legal">
                  {t("dadosDashboard.ropaWizard.labelAbrangenciaBase")}
                </Label>
                <Input
                  id="abrangencia_base_legal"
                  value={formData.abrangencia_base_legal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      abrangencia_base_legal: e.target.value,
                    })
                  }
                  placeholder={t(
                    "dadosDashboard.ropaWizard.placeholderAbrangenciaBase",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="justificativa_base_legal">
                  {t("dadosDashboard.ropaWizard.labelJustificativaBase")}
                </Label>
                <Input
                  id="justificativa_base_legal"
                  value={formData.justificativa_base_legal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      justificativa_base_legal: e.target.value,
                    })
                  }
                  placeholder={t(
                    "dadosDashboard.ropaWizard.placeholderJustificativaBase",
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazo_retencao">
                {t("dadosDashboard.ropaWizard.labelPrazoRetencao")}
              </Label>
              <Input
                id="prazo_retencao"
                value={formData.prazo_retencao}
                onChange={(e) =>
                  setFormData({ ...formData, prazo_retencao: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.ropaWizard.placeholderPrazoRetencao",
                )}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                {t("dadosDashboard.ropaWizard.step3Title")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dadosDashboard.ropaWizard.step3Description")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
              {ativos.map((ativo) => (
                <div
                  key={ativo.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => toggleAtivo(ativo.id)}
                >
                  <Checkbox checked={selectedAtivos.includes(ativo.id)} />
                  <div className="flex-1">
                    <div className="font-medium">{ativo.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatStatus(ativo.tipo)} - {ativo.localizacao}
                    </div>
                  </div>
                  <StatusBadge {...resolveCriticidadeTone(ativo.criticidade)}>
                    {formatStatus(ativo.criticidade)}
                  </StatusBadge>
                </div>
              ))}
            </div>

            {selectedAtivos.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedAtivos.length}{" "}
                {t("dadosDashboard.ropaWizard.step3SelectedSuffix")}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">
                {t("dadosDashboard.ropaWizard.step4Title")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dadosDashboard.ropaWizard.step4Description")}
              </p>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t("dadosDashboard.ropaWizard.labelNomeTratamentoReview")}
                </Label>
                <p className="font-medium">{formData.nome_tratamento}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t("dadosDashboard.ropaWizard.labelDadosVinculados")}
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedDados.map((id) => {
                    const dado = dadosPessoais.find((d) => d.id === id);
                    return (
                      <StatusBadge key={id} tone="neutral">
                        {dado?.nome}
                      </StatusBadge>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t("dadosDashboard.ropaWizard.labelAtivosVinculados")}
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedAtivos.length > 0 ? (
                    selectedAtivos.map((id) => {
                      const ativo = ativos.find((a) => a.id === id);
                      return (
                        <StatusBadge key={id} tone="neutral" variant="outline">
                          {ativo?.nome}
                        </StatusBadge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("dadosDashboard.ropaWizard.nenhumAtivoVinculado")}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {t("dadosDashboard.ropaWizard.labelBaseLegalReview")}
                </Label>
                {/* O passo de revisão mostrava o valor cru do banco
                      ("execucao_contrato"), quando o passo anterior o escolheu
                      pelo rótulo da lei ("Execução de contrato"). */}
                <p className="font-medium">
                  {basesDisponiveis.find((b) => b.key === formData.base_legal)
                    ?.label ?? formatStatus(formData.base_legal)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medidas_seguranca">
                {t("dadosDashboard.ropaWizard.labelMedidasSegurancaOpcional")}
              </Label>
              <Textarea
                id="medidas_seguranca"
                value={formData.medidas_seguranca}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medidas_seguranca: e.target.value,
                  })
                }
                placeholder={t(
                  "dadosDashboard.ropaWizard.placeholderMedidasSeguranca",
                )}
                rows={3}
              />
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
