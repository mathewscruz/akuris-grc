import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDatabase,
  IconSave,
} from "@/components/icons";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";

interface DadosPessoaisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dados?: any;
  readOnly?: boolean;
  registrosDisponiveis?: any[];
}

export function DadosPessoaisDialog({
  isOpen,
  onClose,
  onSave,
  dados,
  readOnly = false,
  registrosDisponiveis = [],
}: DadosPessoaisDialogProps) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();
  const [formData, setFormData] = useState({
    nome: dados?.nome || "",
    descricao: dados?.descricao || "",
    categoria_dados: dados?.categoria_dados || "",
    tipo_dados: dados?.tipo_dados || "",
    sensibilidade: dados?.sensibilidade || "comum",
    nivel_catalogo: dados?.nivel_catalogo || "conjunto",
    registro_pai_id: dados?.registro_pai_id || "",
    titulares_vulneraveis: dados?.titulares_vulneraveis || false,
    origem_validada: dados?.origem_validada || false,
    origem_coleta: dados?.origem_coleta || "",
    finalidade_tratamento: dados?.finalidade_tratamento || "",
    base_legal: dados?.base_legal || "",
    prazo_retencao: dados?.prazo_retencao || "",
    forma_coleta: dados?.forma_coleta || "",
    observacoes: dados?.observacoes || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const totalEtapas = 3;

  /**
   * A lei separa as bases por sensibilidade: dado sensível tem lista própria
   * e mais curta. A lista era única e fixa, o que permitia gravar biometria
   * com base em legítimo interesse — hipótese que a LGPD não admite para dado
   * sensível (Art. 11) nem o RGPD para categoria especial (Art. 9).
   */
  const basesLegaisDaLei = jurisdicao.basesLegais(formData.tipo_dados);

  /**
   * Um valor já gravado que a lei não admite continua na lista, marcado.
   * Apagá-lo ao abrir esconderia do utilizador exactamente o problema que ele
   * precisa de ver — e um registo que ele nunca reviu passaria a parecer
   * apenas "por preencher".
   */
  const baseGravadaForaDaLista =
    formData.base_legal &&
    !basesLegaisDaLei.some((b) => b.key === formData.base_legal)
      ? formData.base_legal
      : null;

  const basesDisponiveis = baseGravadaForaDaLista
    ? [
        {
          key: baseGravadaForaDaLista,
          label: `${jurisdicao.baseLegal(baseGravadaForaDaLista, formData.tipo_dados).label} — ${t("dadosDashboard.dadosPessoaisDialog.baseLegalNaoAdmitida")}`,
        },
        ...basesLegaisDaLei,
      ]
    : basesLegaisDaLei;

  /**
   * Trocar a sensibilidade pode invalidar a base já escolhida — mas só quando
   * é o UTILIZADOR a trocar. Fazer isto num efeito sobre `formData` não
   * distingue essa troca do recarregamento do formulário quando se abre outro
   * registo, e a primeira versão apagava a base gravada só por abrir a
   * biometria para revisão. No handler não há essa ambiguidade.
   */
  const trocarTipoDados = (valor: string) => {
    const permitidas = jurisdicao.basesLegais(valor).map((b) => b.key);
    setFormData((f) => ({
      ...f,
      tipo_dados: valor,
      base_legal:
        f.base_legal && !permitidas.includes(f.base_legal) ? "" : f.base_legal,
    }));
  };

  useEffect(() => {
    setFormData({
      nome: dados?.nome || "",
      descricao: dados?.descricao || "",
      categoria_dados: dados?.categoria_dados || "",
      tipo_dados: dados?.tipo_dados || "",
      sensibilidade: dados?.sensibilidade || "comum",
      nivel_catalogo: dados?.nivel_catalogo || "conjunto",
      registro_pai_id: dados?.registro_pai_id || "",
      titulares_vulneraveis: dados?.titulares_vulneraveis || false,
      origem_validada: dados?.origem_validada || false,
      origem_coleta: dados?.origem_coleta || "",
      finalidade_tratamento: dados?.finalidade_tratamento || "",
      base_legal: dados?.base_legal || "",
      prazo_retencao: dados?.prazo_retencao || "",
      forma_coleta: dados?.forma_coleta || "",
      observacoes: dados?.observacoes || "",
    });
    setEtapa(1);
    setErrors({});
  }, [dados, isOpen]);

  const validarEtapa = (numero: number) => {
    const novos: Record<string, string> = {};
    const obrigatorio = t("dadosDashboard.dadosPessoaisDialog.requiredField");

    if (numero === 1) {
      if (!formData.nome.trim()) novos.nome = obrigatorio;
      if (!formData.categoria_dados) novos.categoria_dados = obrigatorio;
      if (!formData.tipo_dados) novos.tipo_dados = obrigatorio;
      if (!formData.sensibilidade) novos.sensibilidade = obrigatorio;
    }
    if (numero === 2 && !formData.finalidade_tratamento.trim()) {
      novos.finalidade_tratamento = obrigatorio;
    }
    if (numero === 3 && !formData.base_legal) {
      novos.base_legal = obrigatorio;
    }

    setErrors(novos);
    return Object.keys(novos).length === 0;
  };

  const avancar = () => {
    if (!validarEtapa(etapa)) return;
    setEtapa((atual) => Math.min(totalEtapas, atual + 1));
  };

  const handleSave = async () => {
    if (readOnly) return;
    for (let numero = 1; numero <= totalEtapas; numero += 1) {
      if (!validarEtapa(numero)) {
        setEtapa(numero);
        return;
      }
    }

    try {
      setIsLoading(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(t("dadosDashboard.common.errorEmpresaNaoEncontrada"));
      }

      const payload = {
        ...formData,
        registro_pai_id:
          formData.nivel_catalogo === "campo"
            ? formData.registro_pai_id || null
            : null,
        empresa_id: profile.empresa_id,
        ...(dados?.id
          ? {}
          : { created_by: (await supabase.auth.getUser()).data.user?.id }),
      };

      if (dados?.id) {
        await exigirLinhas(
          (supabase as any)
            .from("dados_pessoais")
            .update(payload)
            .eq("id", dados.id)
            .select("id"),
        );
        toast({ title: t("dadosDashboard.dadosPessoaisDialog.toastUpdated") });
      } else {
        await exigirEscrita(
          (supabase as any).from("dados_pessoais").insert([payload]),
        );
        toast({ title: t("dadosDashboard.dadosPessoaisDialog.toastCreated") });
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t("dadosDashboard.dadosPessoaisDialog.toastErrorTitle"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={
        dados?.id
          ? t("dadosDashboard.dadosPessoaisDialog.titleEdit")
          : t("dadosDashboard.dadosPessoaisDialog.titleNew")
      }
      description={t("dadosDashboard.dadosPessoaisDialog.stepDescription", {
        current: etapa,
        total: totalEtapas,
      })}
      icon={IconDatabase}
      size="lg"
      /* `isSubmitting`: sem isto o botao nunca se desligava e um
           duplo-clique gravava duas linhas. O estado ja existia — so
           nao chegava ao rodape que sabe usa-lo. */
      isSubmitting={isLoading}
      hideFooter={readOnly}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {t("dadosDashboard.dadosPessoaisDialog.cancel")}
          </Button>
          <div className="flex items-center gap-2">
            {etapa > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrors({});
                  setEtapa((atual) => atual - 1);
                }}
                disabled={isLoading}
              >
                <IconArrowLeft className="mr-1 h-4 w-4" />
                {t("dadosDashboard.dadosPessoaisDialog.previous")}
              </Button>
            )}
            {etapa < totalEtapas ? (
              <Button type="button" size="sm" onClick={avancar}>
                {t("dadosDashboard.dadosPessoaisDialog.next")}
                <IconArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
              >
                <IconSave className="mr-1 h-4 w-4" />
                {isLoading
                  ? t("dadosDashboard.dadosPessoaisDialog.saving")
                  : t("dadosDashboard.dadosPessoaisDialog.save")}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid gap-4 py-4">
        <div
          className="grid grid-cols-3 gap-2"
          role="list"
          aria-label={t("dadosDashboard.dadosPessoaisDialog.stepsLabel")}
        >
          {[1, 2, 3].map((numero) => (
            <div key={numero} role="listitem" className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${numero <= etapa ? "bg-primary" : "bg-muted"}`}
              />
              <p
                className={`text-xs ${numero === etapa ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {t(`dadosDashboard.dadosPessoaisDialog.step${numero}`)}
              </p>
            </div>
          ))}
        </div>

        {etapa === 1 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">
                  {t("dadosDashboard.dadosPessoaisDialog.labelNome")}
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder={t(
                    "dadosDashboard.dadosPessoaisDialog.placeholderNome",
                  )}
                />
                {errors.nome && (
                  <p className="text-xs text-destructive">{errors.nome}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria_dados">
                  {t("dadosDashboard.dadosPessoaisDialog.labelCategoria")}
                </Label>
                <Select
                  value={formData.categoria_dados}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoria_dados: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.dadosPessoaisDialog.placeholderCategoria",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identificacao">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaIdentificacao",
                      )}
                    </SelectItem>
                    <SelectItem value="contato">
                      {t("dadosDashboard.dadosPessoaisDialog.categoriaContato")}
                    </SelectItem>
                    <SelectItem value="localizacao">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaLocalizacao",
                      )}
                    </SelectItem>
                    <SelectItem value="financeiro">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaFinanceiro",
                      )}
                    </SelectItem>
                    <SelectItem value="saude">
                      {t("dadosDashboard.dadosPessoaisDialog.categoriaSaude")}
                    </SelectItem>
                    <SelectItem value="biometrico">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaBiometrico",
                      )}
                    </SelectItem>
                    <SelectItem value="profissional">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaProfissional",
                      )}
                    </SelectItem>
                    <SelectItem value="comportamental">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.categoriaComportamental",
                      )}
                    </SelectItem>
                    <SelectItem value="outros">
                      {t("dadosDashboard.dadosPessoaisDialog.categoriaOutros")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.categoria_dados && (
                  <p className="text-xs text-destructive">
                    {errors.categoria_dados}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo_dados">
                  {t("dadosDashboard.dadosPessoaisDialog.labelTipoDados")}
                </Label>
                <Select
                  value={formData.tipo_dados}
                  onValueChange={trocarTipoDados}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.dadosPessoaisDialog.placeholderTipoDados",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comum">
                      {t("dadosDashboard.dadosPessoaisDialog.tipoComum")}
                    </SelectItem>
                    <SelectItem value="sensivel">
                      {t("dadosDashboard.dadosPessoaisDialog.tipoSensivel")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo_dados && (
                  <p className="text-xs text-destructive">
                    {errors.tipo_dados}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sensibilidade">
                  {t("dadosDashboard.dadosPessoaisDialog.labelSensibilidade")}
                </Label>
                <Select
                  value={formData.sensibilidade}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sensibilidade: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.dadosPessoaisDialog.placeholderSensibilidade",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comum">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.sensibilidadeComum",
                      )}
                    </SelectItem>
                    <SelectItem value="sensivel">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.sensibilidadeSensivel",
                      )}
                    </SelectItem>
                    <SelectItem value="muito_sensivel">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.sensibilidadeMuitoSensivel",
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.sensibilidade && (
                  <p className="text-xs text-destructive">
                    {errors.sensibilidade}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("privacidadePrograma.catalogo.nivel")}</Label>
                <Select
                  value={formData.nivel_catalogo}
                  onValueChange={(value) =>
                    setFormData({ ...formData, nivel_catalogo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conjunto">
                      {t("privacidadePrograma.catalogo.conjunto")}
                    </SelectItem>
                    <SelectItem value="campo">
                      {t("privacidadePrograma.catalogo.campo")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-3 self-end rounded-md border px-3 py-2.5 text-sm">
                <Checkbox
                  checked={formData.titulares_vulneraveis}
                  onCheckedChange={(value) =>
                    setFormData({
                      ...formData,
                      titulares_vulneraveis: value === true,
                    })
                  }
                />
                <span>{t("privacidadePrograma.catalogo.vulneraveis")}</span>
              </label>
            </div>

            {formData.nivel_catalogo === "campo" && (
              <div className="space-y-2">
                <Label>{t("privacidadePrograma.catalogo.pai")}</Label>
                <Select
                  value={formData.registro_pai_id || "nenhum"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      registro_pai_id: value === "nenhum" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">
                      {t("privacidadePrograma.catalogo.semPai")}
                    </SelectItem>
                    {registrosDisponiveis
                      .filter(
                        (item) =>
                          item.id !== dados?.id &&
                          (item.nivel_catalogo || "conjunto") === "conjunto",
                      )
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="descricao">
                {t("dadosDashboard.dadosPessoaisDialog.labelDescricao")}
              </Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.dadosPessoaisDialog.placeholderDescricao",
                )}
              />
            </div>
          </>
        )}

        {etapa === 2 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="origem_coleta">
                  {t("dadosDashboard.dadosPessoaisDialog.labelOrigemColeta")}
                </Label>
                <Select
                  value={formData.origem_coleta}
                  onValueChange={(value) =>
                    setFormData({ ...formData, origem_coleta: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.dadosPessoaisDialog.placeholderOrigemColeta",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formulario_web">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.origemFormularioWeb",
                      )}
                    </SelectItem>
                    <SelectItem value="sistema_interno">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.origemSistemaInterno",
                      )}
                    </SelectItem>
                    <SelectItem value="terceiros">
                      {t("dadosDashboard.dadosPessoaisDialog.origemTerceiros")}
                    </SelectItem>
                    <SelectItem value="publico">
                      {t("dadosDashboard.dadosPessoaisDialog.origemPublico")}
                    </SelectItem>
                    <SelectItem value="diretamente_titular">
                      {t(
                        "dadosDashboard.dadosPessoaisDialog.origemDiretamenteTitular",
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forma_coleta">
                  {t("dadosDashboard.dadosPessoaisDialog.labelFormaColeta")}
                </Label>
                <Select
                  value={formData.forma_coleta}
                  onValueChange={(value) =>
                    setFormData({ ...formData, forma_coleta: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t(
                        "dadosDashboard.dadosPessoaisDialog.placeholderFormaColeta",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatica">
                      {t("dadosDashboard.dadosPessoaisDialog.formaAutomatica")}
                    </SelectItem>
                    <SelectItem value="manual">
                      {t("dadosDashboard.dadosPessoaisDialog.formaManual")}
                    </SelectItem>
                    <SelectItem value="importacao">
                      {t("dadosDashboard.dadosPessoaisDialog.formaImportacao")}
                    </SelectItem>
                    <SelectItem value="integracao">
                      {t("dadosDashboard.dadosPessoaisDialog.formaIntegracao")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm">
              <Checkbox
                checked={formData.origem_validada}
                onCheckedChange={(value) =>
                  setFormData({ ...formData, origem_validada: value === true })
                }
              />
              <span>{t("privacidadePrograma.catalogo.origemValidada")}</span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="finalidade_tratamento">
                {t(
                  "dadosDashboard.dadosPessoaisDialog.labelFinalidadeTratamento",
                )}
              </Label>
              <Textarea
                id="finalidade_tratamento"
                value={formData.finalidade_tratamento}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    finalidade_tratamento: e.target.value,
                  })
                }
                placeholder={t(
                  "dadosDashboard.dadosPessoaisDialog.placeholderFinalidadeTratamento",
                )}
              />
              {errors.finalidade_tratamento && (
                <p className="text-xs text-destructive">
                  {errors.finalidade_tratamento}
                </p>
              )}
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              {t("dadosDashboard.dadosPessoaisDialog.legalGuidance")}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base_legal">
                  {t("dadosDashboard.dadosPessoaisDialog.labelBaseLegal")}
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
                        "dadosDashboard.dadosPessoaisDialog.placeholderBaseLegal",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {basesDisponiveis.map((base) => (
                      <SelectItem key={base.key} value={base.key}>
                        {base.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.base_legal && (
                  <p className="text-xs text-destructive">
                    {errors.base_legal}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo_retencao">
                  {t("dadosDashboard.dadosPessoaisDialog.labelPrazoRetencao")}
                </Label>
                <Input
                  id="prazo_retencao"
                  value={formData.prazo_retencao}
                  onChange={(e) =>
                    setFormData({ ...formData, prazo_retencao: e.target.value })
                  }
                  placeholder={t(
                    "dadosDashboard.dadosPessoaisDialog.placeholderPrazoRetencao",
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">
                {t("dadosDashboard.dadosPessoaisDialog.labelObservacoes")}
              </Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.dadosPessoaisDialog.placeholderObservacoes",
                )}
              />
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}
