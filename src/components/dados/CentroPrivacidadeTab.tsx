import { useState } from "react";
import { useListState } from "@/hooks/useListState";
import { PrivacyProgramNavigation } from "./PrivacyProgramNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TabsContent } from "@/components/ui/tabs";
import { DialogShell } from "@/components/ui/dialog-shell";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { AnimatedMetricValue } from "@/components/ui/stat-strip";
import { ModuleBanner } from "@/components/ui/module-banner";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  IconAdd,
  IconArrowRight,
  IconCheck,
  IconChecklist,
  IconDatabase,
  IconDelete,
  IconEdit,
  IconFileCheck,
  IconGlobe,
  IconHistory,
  IconLink,
  IconScale,
  IconShieldAlert,
  IconUsers,
  PrivacidadeIcon,
} from "@/components/icons";
import { exigirEscrita, exigirLinhas } from "@/lib/supabase-write";
import { toast } from "@/lib/toast";
import {
  formatarDiaParaDB,
  formatDateOnly,
  formatDateTime,
  parseDataLocal,
} from "@/lib/date-utils";

type Area =
  | "avaliacao"
  | "fluxo"
  | "terceiro"
  | "retencao"
  | "consentimento"
  | "incidente"
  | "portal";

interface Props {
  dadosPessoais: any[];
  ropaRegistros: any[];
  solicitacoes: any[];
  incidentesPrivacidade: number;
  onNavigate: (tab: string) => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const TABLE: Record<Area, string> = {
  avaliacao: "privacidade_avaliacoes",
  fluxo: "dados_fluxos",
  terceiro: "privacidade_terceiros",
  retencao: "privacidade_retencoes",
  consentimento: "privacidade_consentimentos",
  incidente: "privacidade_incidente_detalhes",
  portal: "privacidade_portais",
};

const vazio = (area: Area): any => {
  const hoje = formatarDiaParaDB(new Date());
  const comum = { id: "", empresa_id: "", created_at: "", updated_at: "" };
  switch (area) {
    case "avaliacao":
      return {
        ...comum,
        tipo: "ripd",
        titulo: "",
        descricao: "",
        ropa_id: "",
        projeto_id: "",
        terceiro_id: "",
        risco_id: "",
        plano_acao_id: "",
        necessidade: "",
        proporcionalidade: "",
        riscos: "",
        medidas: "",
        criterios: {
          necessidade: false,
          minimizacao: false,
          direitos: false,
          seguranca: false,
          dpo: false,
        },
        nivel_risco: "medio",
        status: "rascunho",
        conclusao: "",
        proxima_revisao: "",
      };
    case "fluxo":
      return {
        ...comum,
        nome_fluxo: "",
        dados_pessoais_id: "",
        sistema_origem: "",
        sistema_destino: "",
        tipo_transferencia: "api",
        frequencia: "eventual",
        criptografia_transit: false,
        aprovacao_necessaria: false,
        observacoes: "",
        status: "ativo",
      };
    case "terceiro":
      return {
        ...comum,
        nome: "",
        papel: "operador",
        pais: "",
        dados_categorias: "",
        finalidade: "",
        mecanismo_transferencia: "",
        contrato_id: "",
        ropa_id: "",
        status: "em_avaliacao",
        proxima_revisao: "",
        observacoes: "",
      };
    case "retencao":
      return {
        ...comum,
        nome: "",
        dado_id: "",
        ropa_id: "",
        gatilho: "",
        prazo_quantidade: "",
        prazo_unidade: "anos",
        fundamento: "",
        acao_destino: "eliminar",
        legal_hold: false,
        proxima_execucao: "",
        status: "ativo",
      };
    case "consentimento":
      return {
        ...comum,
        titular_referencia: "",
        finalidade: "",
        versao_aviso: "",
        canal: "",
        coletado_em: hoje,
        status: "valido",
        evidencia: "",
        ropa_id: "",
      };
    case "incidente":
      return {
        ...comum,
        incidente_id: "",
        detectado_em: "",
        conhecimento_em: "",
        prazo_autoridade: "",
        titulares_estimados: "",
        categorias_dados: "",
        natureza_incidente: "",
        risco_titulares: "",
        medidas_mitigacao: "",
        decisao_notificar: "em_analise",
        justificativa_decisao: "",
        conteudo_comunicacao: "",
        motivo_atraso: "",
        autoridade_notificada_em: "",
        titulares_notificados_em: "",
        evidencia: "",
      };
    case "portal":
      return {
        ...comum,
        slug: "",
        titulo: "Portal de Privacidade",
        introducao: "",
        contato_dpo: "",
        ativo: false,
      };
  }
};

export function CentroPrivacidadeTab(props: Props) {
  const { t } = useLanguage();
  const { empresaId } = useEmpresaId();
  const qc = useQueryClient();
  const [subtab, setSubtab] = useListState("privacyProgramArea", "visao");
  const [dialog, setDialog] = useState<{ area: Area; item: any } | null>(null);
  const [apagar, setApagar] = useState<{ area: Area; id: string } | null>(null);

  const queryKey = ["centro-privacidade", empresaId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    enabled: !!empresaId,
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db.rpc("obter_centro_privacidade", {
        p_empresa_id: empresaId,
      });
      if (error) throw error;
      return data;
    },
  });

  const d = data || {
    avaliacoes: [],
    fluxos: [],
    terceiros: [],
    retencoes: [],
    consentimentos: [],
    detalhesIncidentes: [],
    portal: null,
    auditoria: [],
    incidentes: [],
    projetos: [],
    riscos: [],
    planos: [],
    contratos: [],
  };
  const completosCatalogo = props.dadosPessoais.filter(
    (x) =>
      x.nome?.trim() && x.origem_coleta && x.prazo_retencao && x.base_legal,
  ).length;
  const ropasCompletos = props.ropaRegistros.filter(
    (x) =>
      x.finalidade &&
      x.prazo_retencao &&
      (x.bases_legais?.length || x.base_legal) &&
      x.risco_probabilidade &&
      x.risco_impacto,
  ).length;
  const avaliacoesAprovadas = d.avaliacoes.filter(
    (x: any) => x.status === "aprovada",
  ).length;
  const pendencias = [
    props.dadosPessoais.length > 0,
    props.dadosPessoais.length > 0 &&
      completosCatalogo === props.dadosPessoais.length,
    d.fluxos.length > 0,
    props.ropaRegistros.length > 0,
    props.ropaRegistros.length > 0 &&
      ropasCompletos === props.ropaRegistros.length,
    avaliacoesAprovadas > 0,
    d.retencoes.length > 0,
    d.terceiros.length > 0,
    !!d.portal?.ativo,
    props.solicitacoes.every(
      (s) =>
        ["atendida", "rejeitada"].includes(s.status) ||
        parseDataLocal(s.prazo_resposta) >= new Date(),
    ),
    props.incidentesPrivacidade === 0,
  ];
  const maturidade = Math.round(
    (pendencias.filter(Boolean).length / pendencias.length) * 100,
  );
  const temRegistros = [props.dadosPessoais, props.ropaRegistros, props.solicitacoes,
    d.avaliacoes, d.fluxos, d.terceiros, d.retencoes, d.consentimentos, d.incidentes]
    .some((items) => items.length > 0) || !!d.portal;
  const progresso = (completos: number, total: number) => total > 0
    ? t("experience.completedRecords", { completed: completos, total })
    : t("experience.notStarted");

  const editar = (area: Area, item?: any) =>
    setDialog({ area, item: item ? { ...item } : vazio(area) });
  const remover = async () => {
    if (!apagar || !empresaId) return;
    try {
      await exigirLinhas(
        (supabase as any)
          .from(TABLE[apagar.area])
          .delete()
          .eq("id", apagar.id)
          .eq("empresa_id", empresaId)
          .select("id"),
      );
      toast.success(t("privacidadePrograma.comum.excluido"));
      setApagar(null);
      await qc.invalidateQueries({ queryKey });
    } catch (error: any) {
      toast.error(t("privacidadePrograma.comum.erroExcluir"), {
        description: error?.message,
      });
    }
  };

  const abrirArea = (area: string) => setSubtab(area);
  if (isError)
    return (
      <Erro
        onRetry={() => void refetch()}
        texto={t("privacidadePrograma.erroCarregamentoDescricao")}
      />
    );
  if (isLoading) return <div role="status" aria-label={t("common.loading")} className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-5">
      <PrivacyProgramNavigation value={subtab} onValueChange={setSubtab}>
        <TabsContent value="visao" className="space-y-4">
      <ModuleBanner
        icon={PrivacidadeIcon}
        iconClassName="right-6 lg:right-[18.5rem]"
        contentClassName="grid gap-4 p-4 xl:grid-cols-[1fr_220px] xl:items-center"
      >
          <div>
            <Badge
              variant="outline"
              className="mb-2 border-primary/30 text-primary"
            >
              {t("privacidadePrograma.badge")}
            </Badge>
            <h2 className="text-lg font-semibold">
              {t("privacidadePrograma.titulo")}
            </h2>
            <details className="mt-2 max-w-3xl text-sm text-muted-foreground">
              <summary className="cursor-pointer rounded-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("experience.privacyGuide")}</summary>
              <p className="mt-2">{t("privacidadePrograma.descricao")}</p>
              <p className="mt-2">{t("experience.privacyScoreMethod")}</p>
            </details>
          </div>
          <div className="rounded-md border bg-card/90 p-3">
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium">
                {t("privacidadePrograma.maturidade")}
              </span>
              <strong className="text-2xl tabular-nums">{temRegistros ? <AnimatedMetricValue value={`${maturidade}%`} /> : "—"}</strong>
            </div>
            {temRegistros && <Progress value={maturidade} aria-label={t("privacidadePrograma.maturidade")} className="mt-2" />}
            <p className="mt-2 text-xs text-muted-foreground">
              {t(temRegistros ? "experience.privacyScoreHint" : "experience.privacyNoEvidence")}
            </p>
          </div>
      </ModuleBanner>

          <div className="grid gap-3 xl:grid-cols-2">
            <Etapa
              numero={1}
              titulo={t("privacidadePrograma.etapas.inventario")}
              descricao={t("privacidadePrograma.etapas.inventarioDesc")}
              completo={
                props.dadosPessoais.length > 0 &&
                completosCatalogo === props.dadosPessoais.length
              }
              detalhe={progresso(completosCatalogo, props.dadosPessoais.length)}
              onClick={() => props.onNavigate("catalogo")}
            />
            <Etapa
              numero={2}
              titulo={t("privacidadePrograma.etapas.fluxos")}
              descricao={t("privacidadePrograma.etapas.fluxosDesc")}
              completo={d.fluxos.length > 0}
              detalhe={String(d.fluxos.length)}
              onClick={() => abrirArea("fluxos")}
            />
            <Etapa
              numero={3}
              titulo={t("privacidadePrograma.etapas.ropa")}
              descricao={t("privacidadePrograma.etapas.ropaDesc")}
              completo={
                props.ropaRegistros.length > 0 &&
                ropasCompletos === props.ropaRegistros.length
              }
              detalhe={progresso(ropasCompletos, props.ropaRegistros.length)}
              onClick={() => props.onNavigate("ropa")}
            />
            <Etapa
              numero={4}
              titulo={t("privacidadePrograma.etapas.avaliar")}
              descricao={t("privacidadePrograma.etapas.avaliarDesc")}
              completo={avaliacoesAprovadas > 0}
              detalhe={progresso(avaliacoesAprovadas, d.avaliacoes.length)}
              onClick={() => abrirArea("avaliacoes")}
            />
            <Etapa
              numero={5}
              titulo={t("privacidadePrograma.etapas.governar")}
              descricao={t("privacidadePrograma.etapas.governarDesc")}
              completo={d.terceiros.length > 0 && d.retencoes.length > 0}
              detalhe={`${d.terceiros.length + d.retencoes.length}`}
              onClick={() => abrirArea("terceiros")}
            />
            <Etapa
              numero={6}
              titulo={t("privacidadePrograma.etapas.monitorar")}
              descricao={t("privacidadePrograma.etapas.monitorarDesc")}
              completo={temRegistros && props.incidentesPrivacidade === 0 && pendencias[9]}
              detalhe={String(props.solicitacoes.length + d.incidentes.length)}
              onClick={() => props.onNavigate("solicitacoes")}
            />
          </div>
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <Resumo
                icon={IconScale}
                label={t("privacidadePrograma.resumo.avaliacoes")}
                value={d.avaliacoes.length}
                attention={d.avaliacoes.some(
                  (x: any) =>
                    ["alto", "critico"].includes(x.nivel_risco) &&
                    x.status !== "aprovada",
                )}
              />
              <Resumo
                icon={IconUsers}
                label={t("privacidadePrograma.resumo.terceiros")}
                value={d.terceiros.length}
                attention={d.terceiros.some((x: any) =>
                  ["restrito", "bloqueado"].includes(x.status),
                )}
              />
              <Resumo
                icon={IconShieldAlert}
                label={t("privacidadePrograma.resumo.incidentes")}
                value={d.incidentes.length}
                attention={props.incidentesPrivacidade > 0}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avaliacoes" className="space-y-4">
          <details className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("experience.privacyGlossary")}</summary>
            <p className="mt-2 leading-relaxed">{t("experience.privacyGlossaryText")}</p>
          </details>
          <Lista
            area="avaliacao"
            items={d.avaliacoes}
            loading={isLoading}
            title={t("privacidadePrograma.avaliacoes.titulo")}
            description={t("privacidadePrograma.avaliacoes.descricao")}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            canDelete={props.canDelete}
            onCreate={() => editar("avaliacao")}
            onEdit={(x) => editar("avaliacao", x)}
            onDelete={(x) => setApagar({ area: "avaliacao", id: x.id })}
            render={(x) => (
              <>
                <StatusBadge
                  tone={
                    x.status === "aprovada"
                      ? "success"
                      : x.nivel_risco === "critico"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {t(`privacidadePrograma.tipos.${x.tipo}`)}
                </StatusBadge>
                <span>{t(`privacidadePrograma.status.${x.status}`)}</span>
                <span>{t(`privacidadePrograma.risco.${x.nivel_risco}`)}</span>
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="fluxos">
          <Lista
            area="fluxo"
            items={d.fluxos}
            loading={isLoading}
            title={t("privacidadePrograma.fluxos.titulo")}
            description={t("privacidadePrograma.fluxos.descricao")}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            canDelete={props.canDelete}
            onCreate={() => editar("fluxo")}
            onEdit={(x) => editar("fluxo", x)}
            onDelete={(x) => setApagar({ area: "fluxo", id: x.id })}
            render={(x) => (
              <>
                <span>
                  {x.sistema_origem} → {x.sistema_destino}
                </span>
                <StatusBadge
                  tone={x.criptografia_transit ? "success" : "warning"}
                >
                  {x.criptografia_transit
                    ? t("privacidadePrograma.fluxos.criptografado")
                    : t("privacidadePrograma.fluxos.semCriptografia")}
                </StatusBadge>
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="terceiros">
          <Lista
            area="terceiro"
            items={d.terceiros}
            loading={isLoading}
            title={t("privacidadePrograma.terceiros.titulo")}
            description={t("privacidadePrograma.terceiros.descricao")}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            canDelete={props.canDelete}
            onCreate={() => editar("terceiro")}
            onEdit={(x) => editar("terceiro", x)}
            onDelete={(x) => setApagar({ area: "terceiro", id: x.id })}
            render={(x) => (
              <>
                <StatusBadge
                  tone={
                    x.status === "aprovado"
                      ? "success"
                      : x.status === "bloqueado"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {t(`privacidadePrograma.status.${x.status}`)}
                </StatusBadge>
                <span>{t(`privacidadePrograma.papeis.${x.papel}`)}</span>
                <span>{x.pais || "—"}</span>
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="retencao">
          <Lista
            area="retencao"
            items={d.retencoes}
            loading={isLoading}
            title={t("privacidadePrograma.retencao.titulo")}
            description={t("privacidadePrograma.retencao.descricao")}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            canDelete={props.canDelete}
            onCreate={() => editar("retencao")}
            onEdit={(x) => editar("retencao", x)}
            onDelete={(x) => setApagar({ area: "retencao", id: x.id })}
            render={(x) => (
              <>
                <span>
                  {x.prazo_quantidade
                    ? `${x.prazo_quantidade} ${t(`privacidadePrograma.unidades.${x.prazo_unidade}`)}`
                    : t("privacidadePrograma.unidades.evento")}
                </span>
                <StatusBadge tone={x.legal_hold ? "warning" : "neutral"}>
                  {x.legal_hold
                    ? "Legal hold"
                    : t(`privacidadePrograma.acoes.${x.acao_destino}`)}
                </StatusBadge>
                <span>{formatDateOnly(x.proxima_execucao)}</span>
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="consentimentos">
          <Lista
            area="consentimento"
            items={d.consentimentos}
            loading={isLoading}
            title={t("privacidadePrograma.consentimentos.titulo")}
            description={t("privacidadePrograma.consentimentos.descricao")}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            canDelete={props.canDelete}
            onCreate={() => editar("consentimento")}
            onEdit={(x) => editar("consentimento", x)}
            onDelete={(x) => setApagar({ area: "consentimento", id: x.id })}
            render={(x) => (
              <>
                <StatusBadge
                  tone={x.status === "valido" ? "success" : "warning"}
                >
                  {t(`privacidadePrograma.status.${x.status}`)}
                </StatusBadge>
                <span>{x.finalidade}</span>
                <span>{x.versao_aviso}</span>
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="incidentes">
          <Incidentes
            items={d.incidentes}
            detalhes={d.detalhesIncidentes}
            canCreate={props.canCreate}
            canUpdate={props.canUpdate}
            onEdit={(x) => editar("incidente", x)}
          />
        </TabsContent>
        <TabsContent value="portal">
          <Portal
            portal={d.portal}
            canEdit={d.portal ? props.canUpdate : props.canCreate}
            onEdit={() => editar("portal", d.portal || vazio("portal"))}
          />
        </TabsContent>
        <TabsContent value="auditoria">
          <Auditoria items={d.auditoria} />
        </TabsContent>
      </PrivacyProgramNavigation>

      {dialog && (
        <RegistroDialog
          open
          area={dialog.area}
          initial={dialog.item}
          dados={props.dadosPessoais}
          ropas={props.ropaRegistros}
          projetos={d.projetos}
          riscos={d.riscos}
          planos={d.planos}
          contratos={d.contratos}
          incidentes={d.incidentes}
          terceiros={d.terceiros}
          empresaId={empresaId!}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await qc.invalidateQueries({ queryKey });
          }}
        />
      )}
      <ConfirmDialog
        open={!!apagar}
        onOpenChange={(open) => !open && setApagar(null)}
        title={t("privacidadePrograma.comum.excluirTitulo")}
        description={t("privacidadePrograma.comum.excluirDescricao")}
        variant="destructive"
        onConfirm={remover}
      />
    </div>
  );
}

function Etapa({
  numero,
  titulo,
  descricao,
  completo,
  detalhe,
  onClick,
}: {
  numero: number;
  titulo: string;
  descricao: string;
  completo: boolean;
  detalhe: string;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${completo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
        >
          {completo ? <IconCheck className="h-4 w-4" /> : numero}
        </span>
        <Badge variant="outline">{detalhe}</Badge>
      </div>
      <h3 className="mt-3 font-semibold group-hover:text-primary">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
        {t("privacidadePrograma.comum.abrir")}{" "}
        <IconArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function Resumo({
  icon: Icon,
  label,
  value,
  attention,
}: {
  icon: any;
  label: string;
  value: number;
  attention: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${attention ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums"><AnimatedMetricValue value={value} /></p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Erro({ onRetry, texto }: { onRetry: () => void; texto: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-5"
    >
      <p className="font-medium text-destructive">{texto}</p>
      <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
        {t("privacidadePrograma.comum.tentarNovamente")}
      </Button>
    </div>
  );
}

function Lista({
  items,
  loading,
  title,
  description,
  canCreate,
  canUpdate,
  canDelete,
  onCreate,
  onEdit,
  onDelete,
  render,
}: any) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={onCreate}>
              <IconAdd className="mr-1.5 h-4 w-4" />
              {t("privacidadePrograma.comum.adicionar")}
            </Button>
          )}
        </div>
        <div className="divide-y">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">
              {t("privacidadePrograma.comum.carregando")}
            </p>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <IconChecklist className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t("privacidadePrograma.comum.vazio")}
              </p>
            </div>
          ) : (
            items.map((item: any) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.titulo ||
                      item.nome ||
                      item.nome_fluxo ||
                      item.titular_referencia}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {render(item)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(item)}
                      aria-label={t("common.edit")}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => onDelete(item)}
                      aria-label={t("common.delete")}
                    >
                      <IconDelete className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Incidentes({ items, detalhes, canCreate, canUpdate, onEdit }: any) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-5">
          <h3 className="font-semibold">
            {t("privacidadePrograma.incidentes.titulo")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("privacidadePrograma.incidentes.descricao")}
          </p>
        </div>
        <div className="divide-y">
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("privacidadePrograma.incidentes.vazio")}
            </p>
          ) : (
            items.map((item: any) => {
              const detalhe = detalhes.find(
                (x: any) => x.incidente_id === item.id,
              );
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">{item.titulo}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <StatusBadge
                        tone={
                          detalhe?.decisao_notificar === "notificar"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {t(
                          `privacidadePrograma.decisao.${detalhe?.decisao_notificar || "em_analise"}`,
                        )}
                      </StatusBadge>
                      <span>{item.status}</span>
                      {detalhe?.prazo_autoridade && (
                        <span>
                          {t("privacidadePrograma.incidentes.prazo")}:{" "}
                          {formatDateTime(detalhe.prazo_autoridade)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(detalhe ? canUpdate : canCreate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onEdit({
                          ...vazio("incidente"),
                          ...detalhe,
                          incidente_id: item.id,
                        })
                      }
                    >
                      {detalhe
                        ? t("common.edit")
                        : t("privacidadePrograma.incidentes.avaliar")}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Portal({ portal, canEdit, onEdit }: any) {
  const { t } = useLanguage();
  const href = portal?.slug
    ? `${window.location.origin}/solicitacao-privacidade/${portal.slug}`
    : "";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <IconGlobe className="h-5 w-5 text-primary" />
              {t("privacidadePrograma.portal.titulo")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("privacidadePrograma.portal.descricao")}
            </p>
            {portal && (
              <div className="mt-4 space-y-2">
                <StatusBadge tone={portal.ativo ? "success" : "neutral"}>
                  {portal.ativo
                    ? t("privacidadePrograma.portal.ativo")
                    : t("privacidadePrograma.portal.inativo")}
                </StatusBadge>
                <a
                  className="block break-all text-sm text-primary hover:underline"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {href}
                </a>
              </div>
            )}
          </div>
          {canEdit && (
            <Button size="sm" onClick={onEdit}>
              {portal
                ? t("common.edit")
                : t("privacidadePrograma.portal.configurar")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Auditoria({ items }: any) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <IconHistory className="h-5 w-5 text-primary" />
            {t("privacidadePrograma.auditoria.titulo")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("privacidadePrograma.auditoria.descricao")}
          </p>
        </div>
        <div className="divide-y">
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("privacidadePrograma.auditoria.vazio")}
            </p>
          ) : (
            items.map((item: any) => (
              <div
                key={item.id}
                className="grid gap-1 p-4 text-sm sm:grid-cols-[180px_180px_1fr]"
              >
                <span>{formatDateTime(item.created_at)}</span>
                <span className="font-medium">{item.entidade}</span>
                <span className="text-muted-foreground">
                  {t(`privacidadePrograma.auditoria.acoes.${item.acao}`)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RegistroDialog({
  open,
  area,
  initial,
  dados,
  ropas,
  projetos,
  riscos,
  planos,
  contratos,
  incidentes,
  terceiros,
  empresaId,
  onClose,
  onSaved,
}: any) {
  const { t } = useLanguage();
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (key: string, value: any) => {
    setDirty(true);
    setForm((f: any) => ({ ...f, [key]: value }));
  };
  const editando = !!form.id;
  const salvar = async () => {
    setSaving(true);
    try {
      const obrigatorios: Record<Area, string[]> = {
        avaliacao: ["titulo", "tipo", "necessidade", "riscos", "medidas"],
        fluxo: [
          "nome_fluxo",
          "dados_pessoais_id",
          "sistema_origem",
          "sistema_destino",
        ],
        terceiro: ["nome", "papel", "pais", "finalidade"],
        retencao: ["nome", "gatilho", "fundamento"],
        consentimento: [
          "titular_referencia",
          "finalidade",
          "versao_aviso",
          "evidencia",
        ],
        incidente: [
          "incidente_id",
          "conhecimento_em",
          "natureza_incidente",
          "risco_titulares",
          "medidas_mitigacao",
          "justificativa_decisao",
        ],
        portal: ["slug", "titulo", "contato_dpo"],
      };
      if (obrigatorios[area].some((campo) => !String(form[campo] ?? "").trim()))
        throw new Error(t("privacidadePrograma.comum.preenchaObrigatorios"));
      if (area === "retencao" && !form.dado_id && !form.ropa_id)
        throw new Error(t("privacidadePrograma.retencao.vinculoObrigatorio"));
      if (
        area === "avaliacao" &&
        form.status === "aprovada" &&
        (!form.conclusao?.trim() ||
          !["necessidade", "minimizacao", "direitos", "seguranca", "dpo"].every(
            (item) => form.criterios?.[item] === true,
          ))
      )
        throw new Error(
          t("privacidadePrograma.avaliacoes.aprovacaoIncompleta"),
        );
      const { data: auth } = await supabase.auth.getUser();
      const payload: any = { ...form, empresa_id: empresaId };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      if (area === "terceiro" || area === "incidente")
        payload.categorias_dados = String(form.categorias_dados || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      if (area === "terceiro") {
        payload.ropa_id ||= null;
        payload.contrato_id ||= null;
      }
      if (area === "retencao") {
        payload.prazo_quantidade = form.prazo_quantidade
          ? Number(form.prazo_quantidade)
          : null;
        payload.dado_id ||= null;
        payload.ropa_id ||= null;
      }
      if (area === "avaliacao") {
        payload.ropa_id ||= null;
        payload.projeto_id ||= null;
        payload.terceiro_id ||= null;
        payload.risco_id ||= null;
        payload.plano_acao_id ||= null;
        if (form.status === "aprovada") {
          payload.aprovado_por = auth.user?.id;
          payload.aprovado_em = new Date().toISOString();
        }
      }
      if (area === "consentimento") {
        payload.ropa_id ||= null;
        payload.coletado_em = form.coletado_em
          ? new Date(`${form.coletado_em}T12:00:00`).toISOString()
          : new Date().toISOString();
        payload.revogado_em =
          form.status === "revogado" ? new Date().toISOString() : null;
      }
      if (area === "incidente") {
        payload.titulares_estimados = form.titulares_estimados
          ? Number(form.titulares_estimados)
          : null;
        for (const k of [
          "detectado_em",
          "conhecimento_em",
          "prazo_autoridade",
          "autoridade_notificada_em",
          "titulares_notificados_em",
        ])
          payload[k] ||= null;
      }
      if (area === "portal")
        payload.slug = String(payload.slug)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "");
      if (!editando) payload.created_by = auth.user?.id ?? null;
      if (editando)
        await exigirLinhas(
          (supabase as any)
            .from(TABLE[area])
            .update(payload)
            .eq("id", form.id)
            .eq("empresa_id", empresaId)
            .select("id"),
        );
      else
        await exigirEscrita(
          (supabase as any).from(TABLE[area]).insert(payload),
        );
      toast.success(t("privacidadePrograma.comum.salvo"));
      await onSaved();
    } catch (error: any) {
      toast.error(t("privacidadePrograma.comum.erroSalvar"), {
        description: error?.message,
      });
    } finally {
      setSaving(false);
    }
  };
  const title = t(`privacidadePrograma.dialogos.${area}`);
  return (
    <DialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={title}
      icon={
        area === "avaliacao"
          ? IconScale
          : area === "fluxo"
            ? IconLink
            : area === "terceiro"
              ? IconUsers
              : area === "retencao"
                ? IconDatabase
                : area === "consentimento"
                  ? IconFileCheck
                  : area === "incidente"
                    ? IconShieldAlert
                    : IconGlobe
      }
      size="lg"
      onSubmit={salvar}
      isSubmitting={saving}
      isDirty={dirty}
    >
      <div className="grid gap-4 py-1">
        {area === "avaliacao" && (
          <AvaliacaoForm
            form={form}
            set={set}
            ropas={ropas}
            projetos={projetos}
            terceiros={terceiros}
            riscos={riscos}
            planos={planos}
            t={t}
          />
        )}
        {area === "fluxo" && (
          <FluxoForm form={form} set={set} dados={dados} t={t} />
        )}
        {area === "terceiro" && (
          <TerceiroForm
            form={form}
            set={set}
            ropas={ropas}
            contratos={contratos}
            t={t}
          />
        )}
        {area === "retencao" && (
          <RetencaoForm
            form={form}
            set={set}
            dados={dados}
            ropas={ropas}
            t={t}
          />
        )}
        {area === "consentimento" && (
          <ConsentimentoForm form={form} set={set} ropas={ropas} t={t} />
        )}
        {area === "incidente" && (
          <IncidenteForm form={form} set={set} incidentes={incidentes} t={t} />
        )}
        {area === "portal" && <PortalForm form={form} set={set} t={t} />}
      </div>
    </DialogShell>
  );
}

const Campo = ({ label, children, full = false }: any) => (
  <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
    <Label>{label}</Label>
    {children}
  </div>
);
const Sel = ({ value, set, options }: any) => (
  <Select value={value || ""} onValueChange={set}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map(([v, l]: string[]) => (
        <SelectItem key={v} value={v}>
          {l}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
const Texto = ({ value, set, placeholder = "", type = "text" }: any) => (
  <Input
    type={type}
    value={value || ""}
    onChange={(e) => set(e.target.value)}
    placeholder={placeholder}
  />
);
const AreaTexto = ({ value, set }: any) => (
  <Textarea
    value={value || ""}
    onChange={(e) => set(e.target.value)}
    rows={3}
  />
);
const Escolha = ({ label, checked, set }: any) => (
  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
    <Checkbox checked={!!checked} onCheckedChange={(v) => set(v === true)} />
    {label}
  </label>
);
const opts = (t: any, prefix: string, values: string[]) =>
  values.map((v) => [v, t(`${prefix}.${v}`)]);

function AvaliacaoForm({
  form,
  set,
  ropas,
  projetos,
  terceiros,
  riscos,
  planos,
  t,
}: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.tipo")}>
        <Sel
          value={form.tipo}
          set={(v: string) => set("tipo", v)}
          options={opts(t, "privacidadePrograma.tipos", [
            "ripd",
            "dpia",
            "lia",
            "tia",
            "privacy_by_design",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.titulo")}>
        <Texto value={form.titulo} set={(v: string) => set("titulo", v)} />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.descricao")}>
        <AreaTexto
          value={form.descricao}
          set={(v: string) => set("descricao", v)}
        />
      </Campo>
      <Campo label="ROPA">
        <Sel
          value={form.ropa_id || "nenhum"}
          set={(v: string) => set("ropa_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...ropas.map((x: any) => [x.id, x.nome_tratamento]),
          ]}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.projeto")}>
        <Sel
          value={form.projeto_id || "nenhum"}
          set={(v: string) => set("projeto_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...projetos.map((x: any) => [x.id, x.nome]),
          ]}
        />
      </Campo>
      {form.tipo === "tia" && (
        <Campo label={t("privacidadePrograma.campos.terceiro")}>
          <Sel
            value={form.terceiro_id || "nenhum"}
            set={(v: string) => set("terceiro_id", v === "nenhum" ? "" : v)}
            options={[
              ["nenhum", "—"],
              ...terceiros.map((x: any) => [x.id, x.nome]),
            ]}
          />
        </Campo>
      )}
      <Campo label={t("privacidadePrograma.campos.riscoRelacionado")}>
        <Sel
          value={form.risco_id || "nenhum"}
          set={(v: string) => set("risco_id", v === "nenhum" ? "" : v)}
          options={[["nenhum", "—"], ...riscos.map((x: any) => [x.id, x.nome])]}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.planoRelacionado")}>
        <Sel
          value={form.plano_acao_id || "nenhum"}
          set={(v: string) => set("plano_acao_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...planos.map((x: any) => [x.id, x.titulo]),
          ]}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.necessidade")}>
        <AreaTexto
          value={form.necessidade}
          set={(v: string) => set("necessidade", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.proporcionalidade")}>
        <AreaTexto
          value={form.proporcionalidade}
          set={(v: string) => set("proporcionalidade", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.riscos")}>
        <AreaTexto value={form.riscos} set={(v: string) => set("riscos", v)} />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.medidas")}>
        <AreaTexto
          value={form.medidas}
          set={(v: string) => set("medidas", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.avaliacoes.criteriosTitulo")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {["necessidade", "minimizacao", "direitos", "seguranca", "dpo"].map(
            (item) => (
              <Escolha
                key={item}
                label={t(`privacidadePrograma.avaliacoes.criterios.${item}`)}
                checked={form.criterios?.[item]}
                set={(valor: boolean) =>
                  set("criterios", { ...(form.criterios || {}), [item]: valor })
                }
              />
            ),
          )}
        </div>
      </Campo>
      <Campo label={t("privacidadePrograma.campos.nivelRisco")}>
        <Sel
          value={form.nivel_risco}
          set={(v: string) => set("nivel_risco", v)}
          options={opts(t, "privacidadePrograma.risco", [
            "baixo",
            "medio",
            "alto",
            "critico",
          ])}
        />
      </Campo>
      <Campo label={t("common.status")}>
        <Sel
          value={form.status}
          set={(v: string) => set("status", v)}
          options={opts(t, "privacidadePrograma.status", [
            "rascunho",
            "em_revisao",
            "aprovada",
            "reprovada",
            "revisao_necessaria",
          ])}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.conclusao")}>
        <AreaTexto
          value={form.conclusao}
          set={(v: string) => set("conclusao", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.proximaRevisao")}>
        <Texto
          type="date"
          value={form.proxima_revisao}
          set={(v: string) => set("proxima_revisao", v)}
        />
      </Campo>
    </div>
  );
}
function FluxoForm({ form, set, dados, t }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.nome")}>
        <Texto
          value={form.nome_fluxo}
          set={(v: string) => set("nome_fluxo", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.dado")}>
        <Sel
          value={form.dados_pessoais_id}
          set={(v: string) => set("dados_pessoais_id", v)}
          options={dados.map((x: any) => [
            x.id,
            x.nome || "Cadastro incompleto",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.origem")}>
        <Texto
          value={form.sistema_origem}
          set={(v: string) => set("sistema_origem", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.destino")}>
        <Texto
          value={form.sistema_destino}
          set={(v: string) => set("sistema_destino", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.transferencia")}>
        <Sel
          value={form.tipo_transferencia}
          set={(v: string) => set("tipo_transferencia", v)}
          options={opts(t, "privacidadePrograma.transferencias", [
            "api",
            "arquivo",
            "manual",
            "automatico",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.frequencia")}>
        <Sel
          value={form.frequencia}
          set={(v: string) => set("frequencia", v)}
          options={opts(t, "privacidadePrograma.frequencias", [
            "tempo_real",
            "diaria",
            "semanal",
            "mensal",
            "eventual",
          ])}
        />
      </Campo>
      <Escolha
        label={t("privacidadePrograma.campos.criptografia")}
        checked={form.criptografia_transit}
        set={(v: boolean) => set("criptografia_transit", v)}
      />
      <Escolha
        label={t("privacidadePrograma.campos.aprovacao")}
        checked={form.aprovacao_necessaria}
        set={(v: boolean) => set("aprovacao_necessaria", v)}
      />
      <Campo full label={t("privacidadePrograma.campos.observacoes")}>
        <AreaTexto
          value={form.observacoes}
          set={(v: string) => set("observacoes", v)}
        />
      </Campo>
    </div>
  );
}
function TerceiroForm({ form, set, ropas, contratos, t }: any) {
  const mecanismos = [
    "nao_aplicavel",
    "adequacao",
    "clausulas_padrao",
    "normas_corporativas",
    "clausulas_especificas",
    "certificacao",
    "derrogacao",
  ];
  const mecanismoAtual =
    form.mecanismo_transferencia &&
    !mecanismos.includes(form.mecanismo_transferencia)
      ? [[form.mecanismo_transferencia, form.mecanismo_transferencia]]
      : [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.nome")}>
        <Texto value={form.nome} set={(v: string) => set("nome", v)} />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.papel")}>
        <Sel
          value={form.papel}
          set={(v: string) => set("papel", v)}
          options={opts(t, "privacidadePrograma.papeis", [
            "controlador",
            "controlador_conjunto",
            "operador",
            "suboperador",
            "destinatario",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.pais")}>
        <Texto value={form.pais} set={(v: string) => set("pais", v)} />
      </Campo>
      <Campo label="ROPA">
        <Sel
          value={form.ropa_id || "nenhum"}
          set={(v: string) => set("ropa_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...ropas.map((x: any) => [x.id, x.nome_tratamento]),
          ]}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.contratoRelacionado")}>
        <Sel
          value={form.contrato_id || "nenhum"}
          set={(v: string) => set("contrato_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...contratos.map((x: any) => [x.id, x.nome]),
          ]}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.categorias")}>
        <Texto
          value={
            Array.isArray(form.dados_categorias)
              ? form.dados_categorias.join(", ")
              : form.dados_categorias
          }
          set={(v: string) => set("dados_categorias", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.finalidade")}>
        <AreaTexto
          value={form.finalidade}
          set={(v: string) => set("finalidade", v)}
        />
      </Campo>
      <Campo
        full
        label={t("privacidadePrograma.campos.mecanismoTransferencia")}
      >
        <Sel
          value={form.mecanismo_transferencia}
          set={(v: string) => set("mecanismo_transferencia", v)}
          options={[
            ...mecanismoAtual,
            ...opts(t, "privacidadePrograma.mecanismos", mecanismos),
          ]}
        />
      </Campo>
      <Campo label={t("common.status")}>
        <Sel
          value={form.status}
          set={(v: string) => set("status", v)}
          options={opts(t, "privacidadePrograma.status", [
            "em_avaliacao",
            "aprovado",
            "restrito",
            "bloqueado",
            "inativo",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.proximaRevisao")}>
        <Texto
          type="date"
          value={form.proxima_revisao}
          set={(v: string) => set("proxima_revisao", v)}
        />
      </Campo>
    </div>
  );
}
function RetencaoForm({ form, set, dados, ropas, t }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.nome")}>
        <Texto value={form.nome} set={(v: string) => set("nome", v)} />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.dado")}>
        <Sel
          value={form.dado_id || "nenhum"}
          set={(v: string) => set("dado_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...dados.map((x: any) => [x.id, x.nome || "Cadastro incompleto"]),
          ]}
        />
      </Campo>
      <Campo label="ROPA">
        <Sel
          value={form.ropa_id || "nenhum"}
          set={(v: string) => set("ropa_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...ropas.map((x: any) => [x.id, x.nome_tratamento]),
          ]}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.gatilho")}>
        <Texto value={form.gatilho} set={(v: string) => set("gatilho", v)} />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.prazo")}>
        <div className="grid grid-cols-2 gap-2">
          <Texto
            type="number"
            value={form.prazo_quantidade}
            set={(v: string) => set("prazo_quantidade", v)}
          />
          <Sel
            value={form.prazo_unidade}
            set={(v: string) => set("prazo_unidade", v)}
            options={opts(t, "privacidadePrograma.unidades", [
              "dias",
              "meses",
              "anos",
              "evento",
            ])}
          />
        </div>
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.fundamento")}>
        <AreaTexto
          value={form.fundamento}
          set={(v: string) => set("fundamento", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.acaoDestino")}>
        <Sel
          value={form.acao_destino}
          set={(v: string) => set("acao_destino", v)}
          options={opts(t, "privacidadePrograma.acoes", [
            "eliminar",
            "anonimizar",
            "revisar",
            "arquivar",
          ])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.proximaExecucao")}>
        <Texto
          type="date"
          value={form.proxima_execucao}
          set={(v: string) => set("proxima_execucao", v)}
        />
      </Campo>
      <Escolha
        label="Legal hold"
        checked={form.legal_hold}
        set={(v: boolean) => set("legal_hold", v)}
      />
    </div>
  );
}
function ConsentimentoForm({ form, set, ropas, t }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.titularRef")}>
        <Texto
          value={form.titular_referencia}
          set={(v: string) => set("titular_referencia", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.versaoAviso")}>
        <Texto
          value={form.versao_aviso}
          set={(v: string) => set("versao_aviso", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.finalidade")}>
        <AreaTexto
          value={form.finalidade}
          set={(v: string) => set("finalidade", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.canal")}>
        <Texto value={form.canal} set={(v: string) => set("canal", v)} />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.coletadoEm")}>
        <Texto
          type="date"
          value={String(form.coletado_em || "").slice(0, 10)}
          set={(v: string) => set("coletado_em", v)}
        />
      </Campo>
      <Campo label="ROPA">
        <Sel
          value={form.ropa_id || "nenhum"}
          set={(v: string) => set("ropa_id", v === "nenhum" ? "" : v)}
          options={[
            ["nenhum", "—"],
            ...ropas.map((x: any) => [x.id, x.nome_tratamento]),
          ]}
        />
      </Campo>
      <Campo label={t("common.status")}>
        <Sel
          value={form.status}
          set={(v: string) => set("status", v)}
          options={opts(t, "privacidadePrograma.status", [
            "valido",
            "revogado",
            "expirado",
            "substituido",
          ])}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.evidencia")}>
        <AreaTexto
          value={form.evidencia}
          set={(v: string) => set("evidencia", v)}
        />
      </Campo>
    </div>
  );
}
function IncidenteForm({ form, set, incidentes, t }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.incidente")}>
        <Sel
          value={form.incidente_id}
          set={(v: string) => set("incidente_id", v)}
          options={incidentes.map((x: any) => [x.id, x.titulo])}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.titularesEstimados")}>
        <Texto
          type="number"
          value={form.titulares_estimados}
          set={(v: string) => set("titulares_estimados", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.detectadoEm")}>
        <Texto
          type="datetime-local"
          value={String(form.detectado_em || "").slice(0, 16)}
          set={(v: string) => set("detectado_em", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.conhecimentoEm")}>
        <Texto
          type="datetime-local"
          value={String(form.conhecimento_em || "").slice(0, 16)}
          set={(v: string) => set("conhecimento_em", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.prazoAutoridade")}>
        <Texto
          type="datetime-local"
          value={String(form.prazo_autoridade || "").slice(0, 16)}
          set={(v: string) => set("prazo_autoridade", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.decisao")}>
        <Sel
          value={form.decisao_notificar}
          set={(v: string) => set("decisao_notificar", v)}
          options={opts(t, "privacidadePrograma.decisao", [
            "em_analise",
            "notificar",
            "nao_notificar",
          ])}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.categorias")}>
        <Texto
          value={
            Array.isArray(form.categorias_dados)
              ? form.categorias_dados.join(", ")
              : form.categorias_dados
          }
          set={(v: string) => set("categorias_dados", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.naturezaIncidente")}>
        <AreaTexto
          value={form.natureza_incidente}
          set={(v: string) => set("natureza_incidente", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.riscoTitulares")}>
        <AreaTexto
          value={form.risco_titulares}
          set={(v: string) => set("risco_titulares", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.medidasMitigacao")}>
        <AreaTexto
          value={form.medidas_mitigacao}
          set={(v: string) => set("medidas_mitigacao", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.justificativaDecisao")}>
        <AreaTexto
          value={form.justificativa_decisao}
          set={(v: string) => set("justificativa_decisao", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.autoridadeNotificada")}>
        <Texto
          type="datetime-local"
          value={String(form.autoridade_notificada_em || "").slice(0, 16)}
          set={(v: string) => set("autoridade_notificada_em", v)}
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.titularesNotificados")}>
        <Texto
          type="datetime-local"
          value={String(form.titulares_notificados_em || "").slice(0, 16)}
          set={(v: string) => set("titulares_notificados_em", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.conteudoComunicacao")}>
        <AreaTexto
          value={form.conteudo_comunicacao}
          set={(v: string) => set("conteudo_comunicacao", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.motivoAtraso")}>
        <AreaTexto
          value={form.motivo_atraso}
          set={(v: string) => set("motivo_atraso", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.evidencia")}>
        <AreaTexto
          value={form.evidencia}
          set={(v: string) => set("evidencia", v)}
        />
      </Campo>
    </div>
  );
}
function PortalForm({ form, set, t }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo label={t("privacidadePrograma.campos.slug")}>
        <Texto
          value={form.slug}
          set={(v: string) => set("slug", v)}
          placeholder="minha-empresa"
        />
      </Campo>
      <Campo label={t("privacidadePrograma.campos.titulo")}>
        <Texto value={form.titulo} set={(v: string) => set("titulo", v)} />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.introducao")}>
        <AreaTexto
          value={form.introducao}
          set={(v: string) => set("introducao", v)}
        />
      </Campo>
      <Campo full label={t("privacidadePrograma.campos.contatoDpo")}>
        <Texto
          value={form.contato_dpo}
          set={(v: string) => set("contato_dpo", v)}
        />
      </Campo>
      <Escolha
        label={t("privacidadePrograma.portal.publicar")}
        checked={form.ativo}
        set={(v: boolean) => set("ativo", v)}
      />
    </div>
  );
}
