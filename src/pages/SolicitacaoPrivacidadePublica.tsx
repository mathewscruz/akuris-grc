import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { DIREITOS_TITULAR, JurisdicaoCodigo } from "@/lib/jurisdicao";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { IconCheck, IconMail, IconShield } from "@/components/icons";
import akurisLogo from "@/assets/akuris-logo.png";

export default function SolicitacaoPrivacidadePublica() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { t, locale } = useLanguage();
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [documento, setDocumento] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [aceite, setAceite] = useState(false);
  const [website, setWebsite] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState<"nova" | "consulta">("nova");
  const [consultaProtocolo, setConsultaProtocolo] = useState("");
  const [consultaEmail, setConsultaEmail] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState("");
  const [resultadoConsulta, setResultadoConsulta] = useState<any>(null);

  const portal = useQuery({
    queryKey: ["portal-privacidade-publico", slug],
    enabled: !!slug,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "portal_privacidade_publico",
        { p_slug: slug },
      );
      if (error) throw error;
      return data?.[0] || null;
    },
  });
  const jurisdicao = (portal.data?.jurisdicao || "BR") as JurisdicaoCodigo;
  const direitos = useMemo(
    () => DIREITOS_TITULAR[jurisdicao] || DIREITOS_TITULAR.BR,
    [jurisdicao],
  );

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");
    if (website) return;
    if (!tipo || !nome.trim() || !email.trim() || !detalhes.trim() || !aceite) {
      setErro(t("privacidadePrograma.publico.preencha"));
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "criar_solicitacao_privacidade_publica",
        {
          p_slug: slug,
          p_tipo: tipo,
          p_dados_titular: {
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            telefone: telefone.trim() || undefined,
            documento: documento.trim() || undefined,
          },
          p_dados_solicitados: detalhes.trim(),
          p_justificativa: justificativa.trim() || null,
        },
      );
      if (error) throw error;
      setProtocolo(String(data));
    } catch (cause: any) {
      setErro(cause?.message || t("privacidadePrograma.publico.erro"));
    } finally {
      setEnviando(false);
    }
  };

  const consultar = async (event: FormEvent) => {
    event.preventDefault();
    setErroConsulta("");
    setResultadoConsulta(null);
    const protocoloValido =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        consultaProtocolo.trim(),
      );
    if (!protocoloValido || !consultaEmail.trim().includes("@")) {
      setErroConsulta(t("privacidadePrograma.publico.protocoloInvalido"));
      return;
    }
    setConsultando(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "consultar_solicitacao_privacidade_publica",
        {
          p_slug: slug,
          p_protocolo: consultaProtocolo.trim(),
          p_email: consultaEmail.trim().toLowerCase(),
        },
      );
      if (error) throw error;
      const resultado = data?.[0] || null;
      if (!resultado) {
        setErroConsulta(t("privacidadePrograma.publico.naoEncontrada"));
        return;
      }
      setResultadoConsulta(resultado);
    } catch {
      setErroConsulta(t("privacidadePrograma.publico.erro"));
    } finally {
      setConsultando(false);
    }
  };

  if (portal.isLoading)
    return (
      <PublicShell>
        <p className="text-center text-sm text-muted-foreground">
          {t("privacidadePrograma.comum.carregando")}
        </p>
      </PublicShell>
    );
  if (portal.isError || !portal.data)
    return (
      <PublicShell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">
            {t("privacidadePrograma.publico.indisponivel")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("privacidadePrograma.publico.indisponivelDesc")}
          </p>
        </div>
      </PublicShell>
    );
  if (protocolo)
    return (
      <PublicShell>
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <IconCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold">
              {t("privacidadePrograma.publico.recebida")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("privacidadePrograma.publico.recebidaDesc")}
            </p>
            <div className="mt-5 rounded-lg border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("privacidadePrograma.publico.protocolo")}
              </p>
              <p className="mt-1 break-all font-mono text-sm font-semibold">
                {protocolo}
              </p>
            </div>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => {
                setConsultaProtocolo(protocolo);
                setConsultaEmail(email);
                setProtocolo("");
                setModo("consulta");
              }}
            >
              {t("privacidadePrograma.publico.consultar")}
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    );

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconShield className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-primary">
            {portal.data.empresa_nome}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {portal.data.titulo}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {portal.data.introducao ||
              t("privacidadePrograma.publico.introducaoPadrao")}
          </p>
        </div>
        <div className="mx-auto grid max-w-md grid-cols-2 rounded-lg border bg-card p-1">
          <Button
            type="button"
            variant={modo === "nova" ? "default" : "ghost"}
            onClick={() => setModo("nova")}
          >
            {t("privacidadePrograma.publico.novaSolicitacao")}
          </Button>
          <Button
            type="button"
            variant={modo === "consulta" ? "default" : "ghost"}
            onClick={() => setModo("consulta")}
          >
            {t("privacidadePrograma.publico.consultar")}
          </Button>
        </div>
        {modo === "nova" ? (
          <Card>
            <CardContent className="p-5 sm:p-7">
              <form className="space-y-5" onSubmit={enviar} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="direito">
                    {t("privacidadePrograma.publico.direito")} *
                  </Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger id="direito">
                      <SelectValue
                        placeholder={t(
                          "privacidadePrograma.publico.selecioneDireito",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {direitos.map((direito) => (
                        <SelectItem key={direito} value={direito}>
                          {t(`jurisdicao.direitos.${direito}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nome">
                      {t("privacidadePrograma.publico.nome")} *
                    </Label>
                    <Input
                      id="nome"
                      autoComplete="name"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      {t("privacidadePrograma.publico.email")} *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">
                      {t("privacidadePrograma.publico.telefone")}
                    </Label>
                    <Input
                      id="telefone"
                      type="tel"
                      autoComplete="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="documento">
                      {t("privacidadePrograma.publico.documento")}
                    </Label>
                    <Input
                      id="documento"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("privacidadePrograma.publico.documentoHint")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detalhes">
                    {t("privacidadePrograma.publico.detalhes")} *
                  </Label>
                  <Textarea
                    id="detalhes"
                    rows={5}
                    value={detalhes}
                    onChange={(e) => setDetalhes(e.target.value)}
                    placeholder={t("privacidadePrograma.publico.detalhesHint")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="justificativa">
                    {t("privacidadePrograma.publico.justificativa")}
                  </Label>
                  <Textarea
                    id="justificativa"
                    rows={2}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                </div>
                <div className="sr-only" aria-hidden="true">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={aceite}
                    onCheckedChange={(v) => setAceite(v === true)}
                  />
                  <span>{t("privacidadePrograma.publico.aceite")}</span>
                </label>
                {erro && (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {erro}
                  </p>
                )}
                <Button className="w-full" type="submit" disabled={enviando}>
                  {enviando
                    ? t("privacidadePrograma.publico.enviando")
                    : t("privacidadePrograma.publico.enviar")}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5 sm:p-7">
              <div>
                <h2 className="text-xl font-semibold">
                  {t("privacidadePrograma.publico.consultarTitulo")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("privacidadePrograma.publico.consultarDesc")}
                </p>
              </div>
              <form className="mt-5 space-y-4" onSubmit={consultar} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="consulta-protocolo">
                    {t("privacidadePrograma.publico.protocolo")}
                  </Label>
                  <Input
                    id="consulta-protocolo"
                    autoComplete="off"
                    value={consultaProtocolo}
                    onChange={(event) =>
                      setConsultaProtocolo(event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consulta-email">
                    {t("privacidadePrograma.publico.email")}
                  </Label>
                  <Input
                    id="consulta-email"
                    type="email"
                    autoComplete="email"
                    value={consultaEmail}
                    onChange={(event) => setConsultaEmail(event.target.value)}
                  />
                </div>
                {erroConsulta && (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {erroConsulta}
                  </p>
                )}
                <Button className="w-full" type="submit" disabled={consultando}>
                  {consultando
                    ? t("privacidadePrograma.publico.consultando")
                    : t("privacidadePrograma.publico.consultarAcao")}
                </Button>
              </form>
              {resultadoConsulta && (
                <div
                  className="mt-6 rounded-lg border bg-muted/30 p-5"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      {t("privacidadePrograma.publico.resultado")}
                    </h3>
                    <StatusBadge
                      tone={
                        resultadoConsulta.status === "atendida"
                          ? "success"
                          : resultadoConsulta.status === "rejeitada"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {t(
                        `privacidadePrograma.status.${resultadoConsulta.status}`,
                      )}
                    </StatusBadge>
                  </div>
                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    <PublicDetail
                      label={t("privacidadePrograma.publico.recebidaEm")}
                      value={formatPublicDate(
                        resultadoConsulta.data_solicitacao,
                        locale,
                      )}
                    />
                    <PublicDetail
                      label={t("privacidadePrograma.publico.prazo")}
                      value={formatPublicDate(
                        resultadoConsulta.prorrogada_ate ||
                          resultadoConsulta.prazo_resposta,
                        locale,
                      )}
                    />
                    {resultadoConsulta.data_resposta && (
                      <PublicDetail
                        label={t("privacidadePrograma.publico.respondidaEm")}
                        value={formatPublicDate(
                          resultadoConsulta.data_resposta,
                          locale,
                        )}
                      />
                    )}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {portal.data.contato_dpo && (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <IconMail className="h-4 w-4" />
            {t("privacidadePrograma.publico.dpo")}: {portal.data.contato_dpo}
          </p>
        )}
      </div>
    </PublicShell>
  );
}

function PublicDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function formatPublicDate(
  value: string | null | undefined,
  locale: "pt" | "pt-BR" | "en",
) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "medium",
  }).format(date);
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/[0.06] to-background">
      <header className="border-b border-white/10 bg-[#0A1628] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/">
            <img src={akurisLogo} alt="Akuris" className="h-9 w-auto" />
          </Link>
          <span className="text-xs text-white/70">
            {t("privacidadePrograma.publico.portalSeguro")}
          </span>
        </div>
      </header>
      <main className="px-4 py-10 sm:py-14">{children}</main>
    </div>
  );
}
