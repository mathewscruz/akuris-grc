import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";
import { IconFile, IconCalendar } from "@/components/icons";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parse } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput, parseDateForDB } from "@/lib/date-utils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { RopaCamposDetalhados } from "@/components/dados/RopaCamposDetalhados";
import { dateFnsLocale, datePattern, parseDataLocal } from "@/lib/date-utils";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import { ehDadoSensivel } from "@/lib/jurisdicao";
import { BasesLegaisEditor } from "@/components/dados/BasesLegaisEditor";
import type { BaseLegalEntrada } from "@/hooks/useRopaBasesLegais";

interface RopaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  ropa?: any;
  readOnly?: boolean;
}

export function RopaDialog({
  isOpen,
  onClose,
  onSave,
  ropa,
  readOnly = false,
}: RopaDialogProps) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();
  /**
   * A sensibilidade de um tratamento é a do dado mais sensível que ele toca:
   * se a ROPA inclui um dado sensível, a base legal tem de vir do Art. 11
   * (LGPD) ou do Art. 9 (RGPD), não da lista comum.
   */
  const [tocaDadoSensivel, setTocaDadoSensivel] = useState(false);

  useEffect(() => {
    if (!isOpen || !ropa?.id) {
      setTocaDadoSensivel(false);
      return;
    }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("ropa_dados_vinculados")
        .select("dados_pessoais(sensibilidade)")
        .eq("ropa_id", ropa.id);
      if (!vivo) return;
      setTocaDadoSensivel(
        (data || []).some((v: any) =>
          ehDadoSensivel(v?.dados_pessoais?.sensibilidade),
        ),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [isOpen, ropa?.id]);

  const basesDisponiveis = jurisdicao.basesLegais(
    tocaDadoSensivel ? "sensivel" : "comum",
  );
  /**
   * Os valores do registo, calculados a partir da prop.
   *
   * Extraído para função porque o inicializador de `useState` só corre na
   * PRIMEIRA renderização. Enquanto este diálogo não era renderizado isso não
   * se via; assim que passou a estar sempre na árvore, montou uma vez com
   * `ropa` a nulo e nunca mais recarregou — abrir um registo para editar
   * mostrava o formulário VAZIO, e guardar teria apagado o que lá estava.
   */
  const valoresDe = (r: any) => ({
    nome_tratamento: r?.nome_tratamento || "",
    finalidade: r?.finalidade || "",
    base_legal: r?.base_legal || "",
    categoria_titulares: r?.categoria_titulares || "",
    origem_dados: r?.origem_dados || "",
    compartilhamento_dados: r?.compartilhamento_dados || "",
    transferencia_internacional: r?.transferencia_internacional || false,
    pais_destino: r?.pais_destino || "",
    adequacao_destino: r?.adequacao_destino || "",
    prazo_retencao: r?.prazo_retencao || "",
    medidas_seguranca: r?.medidas_seguranca || "",
    responsavel_tratamento: r?.responsavel_tratamento || "",
    encarregado_dados: r?.encarregado_dados || "",
    controlador_conjunto: r?.controlador_conjunto || "",
    operador_dados: r?.operador_dados || "",
    data_inicio: r?.data_inicio ? parseDataLocal(r.data_inicio) : undefined,
    data_fim: r?.data_fim ? parseDataLocal(r.data_fim) : undefined,
    status: r?.status || "ativo",
    observacoes: r?.observacoes || "",
    codigo: r?.codigo || "",
    area_responsavel: r?.area_responsavel || "",
    dados_tratados: r?.dados_tratados || "",
    categoria_dados: r?.categoria_dados || "",
    fonte_dados: r?.fonte_dados || "",
    descricao_atividade: r?.descricao_atividade || "",
    operacoes_realizadas: r?.operacoes_realizadas || "",
    decisao_automatizada_detalhes: r?.decisao_automatizada_detalhes || "",
    justificativa_base_legal: r?.justificativa_base_legal || "",
    compartilhamento_interno: r?.compartilhamento_interno || "",
    compartilhamento_externo: r?.compartilhamento_externo || "",
    transferencia_detalhes: r?.transferencia_detalhes || "",
    criterio_descarte: r?.criterio_descarte || "",
    risco_probabilidade: r?.risco_probabilidade ?? "",
    risco_impacto: r?.risco_impacto ?? "",
    risco_nivel: r?.risco_nivel || "",
    evidencias_documentos: r?.evidencias_documentos || "",
    versao: r?.versao || "v1",
    // O ROPA a que este tratamento pertence. Sem este campo, um registo que
    // caísse em "Tratamentos sem ROPA" não tinha como sair de lá.
    exercicio_id: r?.exercicio_id || "",
  });

  const [formData, setFormData] = useState(() => valoresDe(ropa));
  const [basesLegais, setBasesLegais] = useState<BaseLegalEntrada[]>([]);

  // Recarrega sempre que o diálogo abre noutro registo.
  useEffect(() => {
    if (isOpen) {
      setFormData(valoresDe(ropa));
      const fallback = [
        {
          base_legal: ropa?.base_legal || "",
          justificativa: ropa?.justificativa_base_legal || "",
          abrangencia: ropa?.base_legal ? "Tratamento completo" : "",
        },
      ];
      setBasesLegais(fallback);
      if (ropa?.id) {
        void supabase
          .from("ropa_bases_legais")
          .select("base_legal, justificativa, abrangencia")
          .eq("ropa_id", ropa.id)
          .order("ordem")
          .then(({ data }) => {
            if (data?.length) setBasesLegais(data as BaseLegalEntrada[]);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ropa?.id]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [ropas, setRopas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { empresaId } = useEmpresaId();

  useEffect(() => {
    if (isOpen) {
      loadUsuarios();
    }
  }, [isOpen]);

  const loadUsuarios = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }

    const { data: listaRopas, error: erroRopas } = await supabase
      .from("ropa_exercicios")
      .select("id, nome, versao")
      .eq("empresa_id", empresaId)
      .order("data_realizacao", { ascending: false });
    if (erroRopas) {
      logger.error("Erro ao carregar ROPAs", { data: erroRopas });
      return;
    }
    setRopas(listaRopas || []);
  };

  /**
   * Guardar o tratamento.
   *
   * A empresa vem de `useEmpresaId()`, que a página já resolveu — antes este
   * método voltava a ler `profiles` a cada gravação e, pior, encadeava a
   * chamada dentro de um `await supabase.auth.getUser()` no meio de um
   * argumento. Quando esse `await` não resolvia, `handleSave` ficava pendurado
   * para sempre: sem pedido, sem erro, sem aviso — carregar em Salvar não fazia
   * absolutamente nada e o diálogo continuava aberto como se nada tivesse
   * acontecido. E a escrita passa por `exigirEscrita`/`exigirLinhas`, porque
   * uma linha barrada por RLS volta sem erro e com zero linhas.
   */
  /**
   * Campos de referência ficam a `null` quando ninguém os escolheu.
   *
   * O formulário guarda `""` no estado (um <Select> sem valor é string vazia),
   * e estas cinco colunas são `uuid`. O Postgres recusa: `invalid input syntax
   * for type uuid: ""`. Como nenhum dos sete tratamentos importados tem
   * responsável ou encarregado preenchido, guardar QUALQUER um deles falhava
   * sempre — o registo não se conseguia editar de todo pela interface.
   */
  const COLUNAS_DE_REFERENCIA = [
    "responsavel_tratamento",
    "encarregado_dados",
    "controlador_conjunto",
    "operador_dados",
    "exercicio_id",
  ] as const;

  const vazioComoNulo = (valores: Record<string, any>) =>
    Object.fromEntries(
      COLUNAS_DE_REFERENCIA.map((c) => [
        c,
        valores[c]?.trim?.() ? valores[c] : null,
      ]),
    );

  const handleSave = async () => {
    if (readOnly) return;
    const basesValidas = basesLegais.filter((b) => b.base_legal);
    if (
      basesValidas.length === 0 ||
      basesValidas.some(
        (b) => !b.justificativa?.trim() || !b.abrangencia?.trim(),
      )
    ) {
      toast({
        title: t("privacidadePrograma.bases.validacao"),
        variant: "destructive",
      });
      return;
    }
    /* O período de tratamento de um registo ROPA é prova de conformidade:
       um que acabe antes de começar entra no relatório tal e qual. */
    if (
      formData.data_inicio &&
      formData.data_fim &&
      formData.data_fim < formData.data_inicio
    ) {
      toast({ title: t("common.fimAntesDoInicio"), variant: "destructive" });
      return;
    }
    try {
      setIsLoading(true);

      if (!empresaId) {
        throw new Error(t("dadosDashboard.common.errorEmpresaNaoEncontrada"));
      }

      const detalhesDecisao = (formData.decisao_automatizada_detalhes || "")
        .trim()
        .toLowerCase();
      const payload = {
        ...formData,
        base_legal: basesValidas[0].base_legal,
        justificativa_base_legal: basesValidas[0].justificativa,
        ...vazioComoNulo(formData),
        decisao_automatizada:
          detalhesDecisao.length > 0 &&
          !detalhesDecisao.startsWith("não") &&
          !detalhesDecisao.startsWith("nao") &&
          !detalhesDecisao.startsWith("no"),
        // Escala numérica da matriz. `risco_nivel` não vai no payload: é
        // escrito por `trg_ropa_risco_calcular`, como em riscos.
        risco_probabilidade: formData.risco_probabilidade
          ? Number(formData.risco_probabilidade)
          : null,
        risco_impacto: formData.risco_impacto
          ? Number(formData.risco_impacto)
          : null,
        data_inicio: formData.data_inicio
          ? parseDateForDB(format(formData.data_inicio, "yyyy-MM-dd"))
          : null,
        data_fim: formData.data_fim
          ? parseDateForDB(format(formData.data_fim, "yyyy-MM-dd"))
          : null,
        empresa_id: empresaId,
        ...(ropa?.id
          ? {}
          : { created_by: (await supabase.auth.getUser()).data.user?.id }),
      };

      let tratamentoId = ropa?.id as string | undefined;
      if (tratamentoId) {
        await exigirLinhas(
          supabase
            .from("ropa_registros")
            .update(payload)
            .eq("id", tratamentoId)
            .select("id"),
        );
        const { error: basesError } = await (supabase as any).rpc(
          "substituir_bases_ropa",
          {
            p_ropa_id: tratamentoId,
            p_bases: basesValidas,
          },
        );
        if (basesError) throw basesError;
        toast({ title: t("dadosDashboard.ropaDialog.toastUpdated") });
      } else {
        const { data } = await exigirEscrita(
          supabase
            .from("ropa_registros")
            .insert([payload])
            .select("id")
            .single(),
        );
        tratamentoId = (data as any)?.id;
        if (tratamentoId) {
          const { error: basesError } = await (supabase as any).rpc(
            "substituir_bases_ropa",
            {
              p_ropa_id: tratamentoId,
              p_bases: basesValidas,
            },
          );
          if (basesError) throw basesError;
        }
        toast({ title: t("dadosDashboard.ropaDialog.toastCreated") });
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t("dadosDashboard.ropaDialog.toastErrorTitle"),
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
        ropa?.id
          ? t("dadosDashboard.ropaDialog.titleEdit")
          : t("dadosDashboard.ropaDialog.titleNew")
      }
      icon={IconFile}
      size="xl"
      /* `isSubmitting`: sem isto o botao nunca se desligava e um
           duplo-clique gravava duas linhas. O estado ja existia — so
           nao chegava ao rodape que sabe usa-lo. */
      onSubmit={handleSave}
      isSubmitting={isLoading}
      hideFooter={readOnly}
    >
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome_tratamento">
              {t("dadosDashboard.ropaDialog.labelNomeTratamento")}
            </Label>
            <Input
              id="nome_tratamento"
              value={formData.nome_tratamento}
              onChange={(e) =>
                setFormData({ ...formData, nome_tratamento: e.target.value })
              }
              placeholder={t(
                "dadosDashboard.ropaDialog.placeholderNomeTratamento",
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exercicio_id">{t("ropaLista.colRopa")}</Label>
            <Select
              value={formData.exercicio_id || "nenhum"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  exercicio_id: value === "nenhum" ? "" : value,
                })
              }
            >
              <SelectTrigger id="exercicio_id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">
                  {t("ropaLista.semRopaNome")}
                </SelectItem>
                {ropas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                    {r.versao ? ` · ${r.versao}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoria_titulares">
              {t("dadosDashboard.ropaDialog.labelCategoriaTitulares")}
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
                    "dadosDashboard.ropaDialog.placeholderCategoriaTitulares",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clientes">
                  {t("dadosDashboard.ropaDialog.categoriaClientes")}
                </SelectItem>
                <SelectItem value="funcionarios">
                  {t("dadosDashboard.ropaDialog.categoriaFuncionarios")}
                </SelectItem>
                <SelectItem value="fornecedores">
                  {t("dadosDashboard.ropaDialog.categoriaFornecedores")}
                </SelectItem>
                <SelectItem value="prospects">
                  {t("dadosDashboard.ropaDialog.categoriaProspects")}
                </SelectItem>
                <SelectItem value="parceiros">
                  {t("dadosDashboard.ropaDialog.categoriaParceiros")}
                </SelectItem>
                <SelectItem value="visitantes">
                  {t("dadosDashboard.ropaDialog.categoriaVisitantes")}
                </SelectItem>
                <SelectItem value="outros">
                  {t("dadosDashboard.ropaDialog.categoriaOutros")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="finalidade">
            {t("dadosDashboard.ropaDialog.labelFinalidade")}
          </Label>
          <Textarea
            id="finalidade"
            value={formData.finalidade}
            onChange={(e) =>
              setFormData({ ...formData, finalidade: e.target.value })
            }
            placeholder={t("dadosDashboard.ropaDialog.placeholderFinalidade")}
          />
        </div>

        <BasesLegaisEditor
          value={basesLegais}
          onChange={setBasesLegais}
          options={basesDisponiveis}
          disabled={readOnly}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-start-1">
            <Label htmlFor="origem_dados">
              {t("dadosDashboard.ropaDialog.labelOrigemDados")}
            </Label>
            <Select
              value={formData.origem_dados}
              onValueChange={(value) =>
                setFormData({ ...formData, origem_dados: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.ropaDialog.placeholderOrigemDados",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diretamente_titular">
                  {t("dadosDashboard.ropaDialog.origemDiretamenteTitular")}
                </SelectItem>
                <SelectItem value="terceiros">
                  {t("dadosDashboard.ropaDialog.origemTerceiros")}
                </SelectItem>
                <SelectItem value="publico">
                  {t("dadosDashboard.ropaDialog.origemPublico")}
                </SelectItem>
                <SelectItem value="misto">
                  {t("dadosDashboard.ropaDialog.origemMisto")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="compartilhamento_dados">
              {t("dadosDashboard.ropaDialog.labelCompartilhamentoDados")}
            </Label>
            <Select
              value={formData.compartilhamento_dados}
              onValueChange={(value) =>
                setFormData({ ...formData, compartilhamento_dados: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.ropaDialog.placeholderCompartilhamentoDados",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_compartilha">
                  {t(
                    "dadosDashboard.ropaDialog.compartilhamentoNaoCompartilha",
                  )}
                </SelectItem>
                <SelectItem value="interno">
                  {t("dadosDashboard.ropaDialog.compartilhamentoInterno")}
                </SelectItem>
                <SelectItem value="terceiros">
                  {t("dadosDashboard.ropaDialog.compartilhamentoTerceiros")}
                </SelectItem>
                <SelectItem value="subsidiarias">
                  {t("dadosDashboard.ropaDialog.compartilhamentoSubsidiarias")}
                </SelectItem>
                <SelectItem value="parceiros">
                  {t("dadosDashboard.ropaDialog.compartilhamentoParceiros")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prazo_retencao">
              {t("dadosDashboard.ropaDialog.labelPrazoRetencao")}
            </Label>
            <Input
              id="prazo_retencao"
              value={formData.prazo_retencao}
              onChange={(e) =>
                setFormData({ ...formData, prazo_retencao: e.target.value })
              }
              placeholder={t(
                "dadosDashboard.ropaDialog.placeholderPrazoRetencao",
              )}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="transferencia_internacional"
            checked={formData.transferencia_internacional}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                transferencia_internacional: !!checked,
              })
            }
          />
          <Label htmlFor="transferencia_internacional">
            {t("dadosDashboard.ropaDialog.labelTransferenciaInternacional")}
          </Label>
        </div>

        {formData.transferencia_internacional && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pais_destino">
                {t("dadosDashboard.ropaDialog.labelPaisDestino")}
              </Label>
              <Input
                id="pais_destino"
                value={formData.pais_destino}
                onChange={(e) =>
                  setFormData({ ...formData, pais_destino: e.target.value })
                }
                placeholder={t(
                  "dadosDashboard.ropaDialog.placeholderPaisDestino",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adequacao_destino">
                {t("dadosDashboard.ropaDialog.labelAdequacaoDestino")}
              </Label>
              <Select
                value={formData.adequacao_destino}
                onValueChange={(value) =>
                  setFormData({ ...formData, adequacao_destino: value })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      "dadosDashboard.ropaDialog.placeholderAdequacaoDestino",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adequado">
                    {t("dadosDashboard.ropaDialog.adequacaoAdequado")}
                  </SelectItem>
                  <SelectItem value="garantias">
                    {t("dadosDashboard.ropaDialog.adequacaoGarantias")}
                  </SelectItem>
                  <SelectItem value="autorizacao_anpd">
                    {t("dadosDashboard.ropaDialog.adequacaoAutorizacaoAnpd")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="responsavel_tratamento">
              {t("dadosDashboard.ropaDialog.labelResponsavelTratamento")}
            </Label>
            <Select
              value={formData.responsavel_tratamento}
              onValueChange={(value) =>
                setFormData({ ...formData, responsavel_tratamento: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.ropaDialog.placeholderResponsavelTratamento",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.user_id} value={usuario.user_id}>
                    {usuario.nome} ({usuario.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="encarregado_dados">
              {t("dadosDashboard.ropaDialog.labelEncarregadoDados")}
            </Label>
            <Select
              value={formData.encarregado_dados}
              onValueChange={(value) =>
                setFormData({ ...formData, encarregado_dados: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.ropaDialog.placeholderEncarregadoDados",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((usuario) => (
                  <SelectItem key={usuario.user_id} value={usuario.user_id}>
                    {usuario.nome} ({usuario.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaDialog.labelDataInicio")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {formData.data_inicio
                    ? format(formData.data_inicio, datePattern(), {
                        locale: dateFnsLocale(),
                      })
                    : t("dadosDashboard.ropaDialog.placeholderSelecionarData")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.data_inicio}
                  onSelect={(date) =>
                    setFormData({ ...formData, data_inicio: date })
                  }
                  locale={dateFnsLocale()}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>{t("dadosDashboard.ropaDialog.labelDataFim")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {formData.data_fim
                    ? format(formData.data_fim, datePattern(), {
                        locale: dateFnsLocale(),
                      })
                    : t("dadosDashboard.ropaDialog.placeholderSelecionarData")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.data_fim}
                  onSelect={(date) =>
                    setFormData({ ...formData, data_fim: date })
                  }
                  locale={dateFnsLocale()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="medidas_seguranca">
            {t("dadosDashboard.ropaDialog.labelMedidasSeguranca")}
          </Label>
          <Textarea
            id="medidas_seguranca"
            value={formData.medidas_seguranca}
            onChange={(e) =>
              setFormData({ ...formData, medidas_seguranca: e.target.value })
            }
            placeholder={t(
              "dadosDashboard.ropaDialog.placeholderMedidasSeguranca",
            )}
          />
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <RopaCamposDetalhados
            values={formData}
            onChange={(key, value) =>
              setFormData((prev) => ({ ...prev, [key]: value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">
            {t("dadosDashboard.ropaDialog.labelObservacoes")}
          </Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) =>
              setFormData({ ...formData, observacoes: e.target.value })
            }
            placeholder={t("dadosDashboard.ropaDialog.placeholderObservacoes")}
          />
        </div>
      </div>
    </DialogShell>
  );
}
