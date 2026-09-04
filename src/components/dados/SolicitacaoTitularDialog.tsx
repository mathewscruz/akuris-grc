import { useState, useEffect, useCallback } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseDateForDB, parseDataLocal } from "@/lib/date-utils";
import { prazoResposta } from "@/lib/jurisdicao";
import { useJurisdicao } from "@/hooks/useJurisdicao";
import {
  tiposSolicitacaoDaJurisdicao,
  normalizarTipoSolicitacao,
  rotuloTipoSolicitacao,
} from "@/lib/direitos-titular";
import { useLanguage } from "@/contexts/LanguageContext";
import { IconCalendar, IconUserCheck } from "@/components/icons";
import { dateFnsLocale, datePattern } from "@/lib/date-utils";
import { opcoesCanalSolicitacao } from "@/lib/canal-solicitacao";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";
import { SolicitacaoTimeline } from "@/components/dados/SolicitacaoTimeline";
import { SolicitacaoAnexos } from "@/components/dados/SolicitacaoAnexos";
interface SolicitacaoTitularDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  solicitacao?: any;
  readOnly?: boolean;
}

export function SolicitacaoTitularDialog({
  isOpen,
  onClose,
  onSave,
  solicitacao,
  readOnly = false,
}: SolicitacaoTitularDialogProps) {
  const { t } = useLanguage();
  const jurisdicao = useJurisdicao();

  /**
   * O prazo de resposta ao titular é o da lei aplicável: 15 dias na LGPD, 1 mês
   * no RGPD/GDPR. Aqui estavam 15 dias fixos em três sítios, sem olhar a
   * jurisdição — uma empresa europeia abria a solicitação já com metade do
   * prazo que a lei lhe dá, e o número contradizia o KPI "Fora do prazo" do
   * ecrã anterior, que sempre usou `prazoResposta`.
   */
  const prazoLegalPadrao = useCallback(
    () =>
      prazoResposta(
        new Date(),
        jurisdicao.codigo,
        jurisdicao.agentePequenoPorte,
      ),
    [jurisdicao.codigo, jurisdicao.agentePequenoPorte],
  );

  // Campos separados para dados do titular (mais amigáveis)
  const [titularNome, setTitularNome] = useState("");
  const [titularEmail, setTitularEmail] = useState("");
  const [titularDocumento, setTitularDocumento] = useState("");
  const [titularTelefone, setTitularTelefone] = useState("");

  const [formData, setFormData] = useState({
    tipo_solicitacao: "",
    dados_solicitados: "",
    justificativa: "",
    canal_solicitacao: "",
    status: "pendente",
    data_resposta: undefined as Date | undefined,
    prazo_resposta: new Date(),
    responsavel_analise: "",
    observacoes_internas: "",
    resposta_titular: "",
    evidencias_atendimento: "",
    recebida_em: new Date(),
    identidade_status: "nao_verificada",
    identidade_metodo: "",
    prorrogada_ate: undefined as Date | undefined,
    motivo_prorrogacao: "",
    motivo_recusa: "",
    canal_resposta: "",
    prazo_fonte: "legal",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Os direitos são os da lei aplicável. Estavam seis escritos à mão, iguais
   * para toda a gente: faltavam a confirmação de tratamento, a anonimização e
   * a informação sobre partilha (LGPD Art. 18) e sobrava a oposição, que é
   * figura do RGPD. Um valor antigo já gravado continua na lista para não
   * desaparecer ao abrir o registo.
   */
  const tiposDaLei = tiposSolicitacaoDaJurisdicao(jurisdicao.codigo, t);
  const tipoGravado = normalizarTipoSolicitacao(formData.tipo_solicitacao);
  const tiposDisponiveis =
    tipoGravado && !tiposDaLei.some((d) => d.key === tipoGravado)
      ? [
          {
            key: tipoGravado,
            label: rotuloTipoSolicitacao(tipoGravado, jurisdicao.codigo, t),
          },
          ...tiposDaLei,
        ]
      : tiposDaLei;

  // Carregar dados existentes quando editar
  useEffect(() => {
    if (solicitacao) {
      const dadosTitular = solicitacao.dados_titular || {};
      setTitularNome(dadosTitular.nome || "");
      setTitularEmail(dadosTitular.email || "");
      setTitularDocumento(dadosTitular.documento || "");
      setTitularTelefone(dadosTitular.telefone || "");

      setFormData({
        tipo_solicitacao: normalizarTipoSolicitacao(
          solicitacao.tipo_solicitacao,
        ),
        dados_solicitados: solicitacao.dados_solicitados || "",
        justificativa: solicitacao.justificativa || "",
        canal_solicitacao: solicitacao.canal_solicitacao || "",
        status: solicitacao.status || "pendente",
        data_resposta: solicitacao.data_resposta
          ? new Date(solicitacao.data_resposta)
          : undefined,
        prazo_resposta: solicitacao.prazo_resposta
          ? parseDataLocal(solicitacao.prazo_resposta)
          : prazoLegalPadrao(),
        responsavel_analise: solicitacao.responsavel_analise || "",
        observacoes_internas: solicitacao.observacoes_internas || "",
        resposta_titular: solicitacao.resposta_titular || "",
        evidencias_atendimento: solicitacao.evidencias_atendimento || "",
        recebida_em: solicitacao.recebida_em
          ? new Date(solicitacao.recebida_em)
          : new Date(solicitacao.data_solicitacao || solicitacao.created_at),
        identidade_status: solicitacao.identidade_status || "nao_verificada",
        identidade_metodo: solicitacao.identidade_metodo || "",
        prorrogada_ate: solicitacao.prorrogada_ate
          ? parseDataLocal(solicitacao.prorrogada_ate)
          : undefined,
        motivo_prorrogacao: solicitacao.motivo_prorrogacao || "",
        motivo_recusa: solicitacao.motivo_recusa || "",
        canal_resposta: solicitacao.canal_resposta || "",
        prazo_fonte: solicitacao.prazo_fonte || "interno",
      });
    } else {
      // Resetar para novo
      setTitularNome("");
      setTitularEmail("");
      setTitularDocumento("");
      setTitularTelefone("");
      setFormData({
        tipo_solicitacao: "",
        dados_solicitados: "",
        justificativa: "",
        canal_solicitacao: "",
        status: "pendente",
        data_resposta: undefined,
        prazo_resposta: prazoLegalPadrao(),
        responsavel_analise: "",
        observacoes_internas: "",
        resposta_titular: "",
        evidencias_atendimento: "",
        recebida_em: new Date(),
        identidade_status: "nao_verificada",
        identidade_metodo: "",
        prorrogada_ate: undefined,
        motivo_prorrogacao: "",
        motivo_recusa: "",
        canal_resposta: "",
        prazo_fonte: "legal",
      });
    }
  }, [solicitacao, isOpen, prazoLegalPadrao]);

  const handleSave = async () => {
    if (readOnly) return;
    try {
      setIsLoading(true);

      // Validar campos obrigatórios
      if (!formData.tipo_solicitacao) {
        toast({
          title: t(
            "dadosDashboard.solicitacaoTitularDialog.toastCampoObrigatorioTitle",
          ),
          description: t(
            "dadosDashboard.solicitacaoTitularDialog.toastCampoObrigatorioDescription",
          ),
          variant: "destructive",
        });
        return;
      }

      if (!titularNome && !titularEmail) {
        toast({
          title: t(
            "dadosDashboard.solicitacaoTitularDialog.toastDadosTitularTitle",
          ),
          description: t(
            "dadosDashboard.solicitacaoTitularDialog.toastDadosTitularDescription",
          ),
          variant: "destructive",
        });
        return;
      }
      if (
        (formData.status === "atendida" || formData.status === "rejeitada") &&
        !["verificada", "dispensada"].includes(formData.identidade_status)
      ) {
        toast({
          title: t("privacidadePrograma.solicitacao.identidadeObrigatoria"),
          variant: "destructive",
        });
        return;
      }
      if (formData.status === "rejeitada" && !formData.motivo_recusa.trim()) {
        toast({
          title: t("privacidadePrograma.solicitacao.motivoRecusaObrigatorio"),
          variant: "destructive",
        });
        return;
      }
      if (formData.prorrogada_ate && !formData.motivo_prorrogacao.trim()) {
        toast({
          title: t(
            "privacidadePrograma.solicitacao.motivoProrrogacaoObrigatorio",
          ),
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.empresa_id) {
        throw new Error(
          t(
            "dadosDashboard.solicitacaoTitularDialog.errorEmpresaNaoEncontrada",
          ),
        );
      }

      // Montar objeto dados_titular a partir dos campos separados
      const dadosTitular = {
        nome: titularNome,
        email: titularEmail,
        documento: titularDocumento,
        telefone: titularTelefone,
      };

      const payload = {
        tipo_solicitacao: formData.tipo_solicitacao,
        dados_titular: dadosTitular,
        dados_solicitados: formData.dados_solicitados,
        justificativa: formData.justificativa,
        canal_solicitacao: formData.canal_solicitacao,
        status: formData.status,
        data_resposta: formData.data_resposta
          ? parseDateForDB(format(formData.data_resposta, "yyyy-MM-dd"))
          : null,
        prazo_resposta: parseDateForDB(
          format(formData.prazo_resposta, "yyyy-MM-dd"),
        ),
        // `responsavel_analise` é `uuid`: um <Select> por escolher guarda ""
        // no estado, e o Postgres recusa com "invalid input syntax for type
        // uuid". Sem responsável escolhido, a solicitação não se gravava.
        responsavel_analise: formData.responsavel_analise || null,
        observacoes_internas: formData.observacoes_internas,
        resposta_titular: formData.resposta_titular,
        evidencias_atendimento: formData.evidencias_atendimento,
        recebida_em: formData.recebida_em.toISOString(),
        identidade_status: formData.identidade_status,
        identidade_metodo: formData.identidade_metodo || null,
        prorrogada_ate: formData.prorrogada_ate
          ? format(formData.prorrogada_ate, "yyyy-MM-dd")
          : null,
        motivo_prorrogacao: formData.motivo_prorrogacao || null,
        motivo_recusa: formData.motivo_recusa || null,
        canal_resposta: formData.canal_resposta || null,
        prazo_fonte: formData.prorrogada_ate
          ? "prorrogado"
          : formData.prazo_fonte,
        empresa_id: profile.empresa_id,
      };

      if (solicitacao?.id) {
        await exigirLinhas(
          supabase
            .from("dados_solicitacoes_titular")
            .update(payload as any)
            .eq("id", solicitacao.id)
            .select("id"),
        );
        toast({
          title: t("dadosDashboard.solicitacaoTitularDialog.toastUpdated"),
        });
      } else {
        await exigirEscrita(
          supabase.from("dados_solicitacoes_titular").insert([payload] as any),
        );
        toast({
          title: t("dadosDashboard.solicitacaoTitularDialog.toastCreated"),
        });
      }

      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: t("dadosDashboard.solicitacaoTitularDialog.toastErrorTitle"),
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
        solicitacao?.id
          ? t("dadosDashboard.solicitacaoTitularDialog.titleEdit")
          : t("dadosDashboard.solicitacaoTitularDialog.titleNew")
      }
      icon={IconUserCheck}
      size="lg"
      /* `isSubmitting`: sem isto o botao nunca se desligava e um
           duplo-clique gravava duas linhas. O estado ja existia — so
           nao chegava ao rodape que sabe usa-lo. */
      onSubmit={handleSave}
      isSubmitting={isLoading}
      hideFooter={readOnly}
    >
      <div className="grid gap-4 py-4">
        {/* Dados do Titular - Campos separados */}
        <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
          <h3 className="font-medium text-sm text-muted-foreground">
            {t("dadosDashboard.solicitacaoTitularDialog.sectionTitularTitle")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="titular_nome">
                {t("dadosDashboard.solicitacaoTitularDialog.labelTitularNome")}
              </Label>
              <Input
                id="titular_nome"
                value={titularNome}
                onChange={(e) => setTitularNome(e.target.value)}
                placeholder={t(
                  "dadosDashboard.solicitacaoTitularDialog.placeholderTitularNome",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titular_email">
                {t("dadosDashboard.solicitacaoTitularDialog.labelTitularEmail")}
              </Label>
              <Input
                id="titular_email"
                type="email"
                value={titularEmail}
                onChange={(e) => setTitularEmail(e.target.value)}
                placeholder={t(
                  "dadosDashboard.solicitacaoTitularDialog.placeholderTitularEmail",
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="titular_documento">
                {t(
                  "dadosDashboard.solicitacaoTitularDialog.labelTitularDocumento",
                )}
              </Label>
              <Input
                id="titular_documento"
                value={titularDocumento}
                onChange={(e) => setTitularDocumento(e.target.value)}
                placeholder={t(
                  "dadosDashboard.solicitacaoTitularDialog.placeholderTitularDocumento",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titular_telefone">
                {t(
                  "dadosDashboard.solicitacaoTitularDialog.labelTitularTelefone",
                )}
              </Label>
              <Input
                id="titular_telefone"
                value={titularTelefone}
                onChange={(e) => setTitularTelefone(e.target.value)}
                placeholder={t(
                  "dadosDashboard.solicitacaoTitularDialog.placeholderTitularTelefone",
                )}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="recebida_em">
              {t("privacidadePrograma.solicitacao.recebidaEm")}
            </Label>
            <Input
              id="recebida_em"
              type="date"
              value={format(formData.recebida_em, "yyyy-MM-dd")}
              onChange={(e) => {
                const recebida = parseDataLocal(e.target.value);
                setFormData({
                  ...formData,
                  recebida_em: recebida,
                  prazo_resposta: prazoResposta(
                    recebida,
                    jurisdicao.codigo,
                    jurisdicao.agentePequenoPorte,
                  ),
                  prazo_fonte: "legal",
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("privacidadePrograma.solicitacao.identidade")}</Label>
            <Select
              value={formData.identidade_status}
              onValueChange={(value) =>
                setFormData({ ...formData, identidade_status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_verificada">
                  {t("privacidadePrograma.solicitacao.identidadeNaoVerificada")}
                </SelectItem>
                <SelectItem value="pendente">
                  {t("privacidadePrograma.solicitacao.identidadePendente")}
                </SelectItem>
                <SelectItem value="verificada">
                  {t("privacidadePrograma.solicitacao.identidadeVerificada")}
                </SelectItem>
                <SelectItem value="dispensada">
                  {t("privacidadePrograma.solicitacao.identidadeDispensada")}
                </SelectItem>
                <SelectItem value="falhou">
                  {t("privacidadePrograma.solicitacao.identidadeFalhou")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="identidade_metodo">
              {t("privacidadePrograma.solicitacao.metodoIdentidade")}
            </Label>
            <Input
              id="identidade_metodo"
              value={formData.identidade_metodo}
              onChange={(e) =>
                setFormData({ ...formData, identidade_metodo: e.target.value })
              }
              placeholder={t(
                "privacidadePrograma.solicitacao.metodoPlaceholder",
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tipo_solicitacao">
              {t(
                "dadosDashboard.solicitacaoTitularDialog.labelTipoSolicitacao",
              )}
            </Label>
            <Select
              value={formData.tipo_solicitacao}
              onValueChange={(value) =>
                setFormData({ ...formData, tipo_solicitacao: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.solicitacaoTitularDialog.placeholderTipoSolicitacao",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {tiposDisponiveis.map((tipo) => (
                  <SelectItem key={tipo.key} value={tipo.key}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="canal_solicitacao">
              {t(
                "dadosDashboard.solicitacaoTitularDialog.labelCanalSolicitacao",
              )}
            </Label>
            <Select
              value={formData.canal_solicitacao}
              onValueChange={(value) =>
                setFormData({ ...formData, canal_solicitacao: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.solicitacaoTitularDialog.placeholderCanalSolicitacao",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {opcoesCanalSolicitacao(t).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prorrogada_ate">
              {t("privacidadePrograma.solicitacao.prorrogadaAte")}
            </Label>
            <Input
              id="prorrogada_ate"
              type="date"
              value={
                formData.prorrogada_ate
                  ? format(formData.prorrogada_ate, "yyyy-MM-dd")
                  : ""
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  prorrogada_ate: e.target.value
                    ? parseDataLocal(e.target.value)
                    : undefined,
                  status: e.target.value ? "prorrogada" : formData.status,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo_prorrogacao">
              {t("privacidadePrograma.solicitacao.motivoProrrogacao")}
            </Label>
            <Input
              id="motivo_prorrogacao"
              value={formData.motivo_prorrogacao}
              onChange={(e) =>
                setFormData({ ...formData, motivo_prorrogacao: e.target.value })
              }
              disabled={!formData.prorrogada_ate}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dados_solicitados">
            {t("dadosDashboard.solicitacaoTitularDialog.labelDadosSolicitados")}
          </Label>
          <Textarea
            id="dados_solicitados"
            value={formData.dados_solicitados}
            onChange={(e) =>
              setFormData({ ...formData, dados_solicitados: e.target.value })
            }
            placeholder={t(
              "dadosDashboard.solicitacaoTitularDialog.placeholderDadosSolicitados",
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="justificativa">
            {t("dadosDashboard.solicitacaoTitularDialog.labelJustificativa")}
          </Label>
          <Textarea
            id="justificativa"
            value={formData.justificativa}
            onChange={(e) =>
              setFormData({ ...formData, justificativa: e.target.value })
            }
            placeholder={t(
              "dadosDashboard.solicitacaoTitularDialog.placeholderJustificativa",
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="status">
              {t("dadosDashboard.solicitacaoTitularDialog.labelStatus")}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "dadosDashboard.solicitacaoTitularDialog.placeholderStatus",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">
                  {t("dadosDashboard.solicitacaoTitularDialog.statusPendente")}
                </SelectItem>
                <SelectItem value="aguardando_identidade">
                  {t("privacidadePrograma.status.aguardando_identidade")}
                </SelectItem>
                <SelectItem value="em_analise">
                  {t("dadosDashboard.solicitacaoTitularDialog.statusEmAnalise")}
                </SelectItem>
                <SelectItem value="em_execucao">
                  {t("privacidadePrograma.status.em_execucao")}
                </SelectItem>
                <SelectItem value="prorrogada">
                  {t("privacidadePrograma.status.prorrogada")}
                </SelectItem>
                <SelectItem value="atendida">
                  {t("dadosDashboard.solicitacaoTitularDialog.statusAtendida")}
                </SelectItem>
                <SelectItem value="rejeitada">
                  {t("dadosDashboard.solicitacaoTitularDialog.statusRejeitada")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              {t("dadosDashboard.solicitacaoTitularDialog.labelPrazoResposta")}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {format(formData.prazo_resposta, datePattern(), {
                    locale: dateFnsLocale(),
                  })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.prazo_resposta}
                  onSelect={(date) =>
                    date &&
                    setFormData({
                      ...formData,
                      prazo_resposta: date,
                      prazo_fonte: "interno",
                    })
                  }
                  locale={dateFnsLocale()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {[
          "em_analise",
          "em_execucao",
          "prorrogada",
          "atendida",
          "rejeitada",
        ].includes(formData.status) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="observacoes_internas">
                {t(
                  "dadosDashboard.solicitacaoTitularDialog.labelObservacoesInternas",
                )}
              </Label>
              <Textarea
                id="observacoes_internas"
                value={formData.observacoes_internas}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    observacoes_internas: e.target.value,
                  })
                }
                placeholder={t(
                  "dadosDashboard.solicitacaoTitularDialog.placeholderObservacoesInternas",
                )}
              />
            </div>

            {(formData.status === "atendida" ||
              formData.status === "rejeitada") && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="canal_resposta">
                      {t("privacidadePrograma.solicitacao.canalResposta")}
                    </Label>
                    <Input
                      id="canal_resposta"
                      value={formData.canal_resposta}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          canal_resposta: e.target.value,
                        })
                      }
                      placeholder={t(
                        "privacidadePrograma.solicitacao.canalRespostaPlaceholder",
                      )}
                    />
                  </div>
                  {formData.status === "rejeitada" && (
                    <div className="space-y-2">
                      <Label htmlFor="motivo_recusa">
                        {t("privacidadePrograma.solicitacao.motivoRecusa")}
                      </Label>
                      <Input
                        id="motivo_recusa"
                        value={formData.motivo_recusa}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motivo_recusa: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    {t(
                      "dadosDashboard.solicitacaoTitularDialog.labelDataResposta",
                    )}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <IconCalendar className="mr-2 h-4 w-4" />
                        {formData.data_resposta
                          ? format(formData.data_resposta, datePattern(), {
                              locale: dateFnsLocale(),
                            })
                          : t(
                              "dadosDashboard.solicitacaoTitularDialog.placeholderSelecionarData",
                            )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.data_resposta}
                        onSelect={(date) =>
                          setFormData({ ...formData, data_resposta: date })
                        }
                        locale={dateFnsLocale()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resposta_titular">
                    {t(
                      "dadosDashboard.solicitacaoTitularDialog.labelRespostaTitular",
                    )}
                  </Label>
                  <Textarea
                    id="resposta_titular"
                    value={formData.resposta_titular}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        resposta_titular: e.target.value,
                      })
                    }
                    placeholder={t(
                      "dadosDashboard.solicitacaoTitularDialog.placeholderRespostaTitular",
                    )}
                  />
                </div>

                {formData.status === "atendida" && (
                  <div className="space-y-2">
                    <Label htmlFor="evidencias_atendimento">
                      {t(
                        "dadosDashboard.solicitacaoTitularDialog.labelEvidenciasAtendimento",
                      )}
                    </Label>
                    <Textarea
                      id="evidencias_atendimento"
                      value={formData.evidencias_atendimento}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          evidencias_atendimento: e.target.value,
                        })
                      }
                      placeholder={t(
                        "dadosDashboard.solicitacaoTitularDialog.placeholderEvidenciasAtendimento",
                      )}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
        {solicitacao?.id && (
          <>
            <SolicitacaoAnexos solicitacao={solicitacao} readOnly={readOnly} />
            <SolicitacaoTimeline
              solicitacaoId={solicitacao.id}
              readOnly={readOnly}
            />
          </>
        )}
      </div>
    </DialogShell>
  );
}
