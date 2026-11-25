import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";

type Sugestao = {
  id: string; provider: string; regra_id: string; estado: "aberta" | "aceita" | "descartada" | "corrigida";
  evidencia: { total?: number; itens?: string[]; refs?: { id: string; nome: string; url: string | null }[]; alvos?: string[] };
  probabilidade: number; impacto: number; relevancia: number; alcance: Record<string, unknown> | null;
  risco_id: string | null; motivo_descarte: string | null; ultima_deteccao: string; corrigida_em: string | null;
  fonte: string | null; severidade_tecnica: string | null; recorrencias: number; suprimido_ate: string | null;
};

const LOGO: Record<string, { src: string; nome: string }> = {
  google_workspace: { src: "/integrations/google-workspace.svg", nome: "Google Workspace" },
  microsoft: { src: "/integrations/microsoft365.svg", nome: "Microsoft 365" },
};
const logoOf = (p: string) => LOGO[p] ?? LOGO.microsoft;

// Technical severity from the provider; the business level is assessed in the company's own matrix when accepting.
const SEV_TONE: Record<string, "destructive" | "warning" | "neutral"> = { alta: "destructive", media: "warning", baixa: "neutral" };
const SEV_ORDER: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
const COB_TONE = { ok: "success", partial: "warning", permission_missing: "warning", unavailable: "neutral", not_evaluated: "neutral" } as const;
const PERMISSOES: Record<string, string> = {
  alerta: "Microsoft Graph · SecurityIncident.Read.All", usuarios_alto_risco: "Microsoft Graph · IdentityRiskyUser.Read.All",
  secure_score_recomendacoes: "Microsoft Graph · SecurityEvents.Read.All", recomendacoes_defender: "Microsoft Defender for Endpoint · SecurityRecommendation.Read.All",
};
const permissaoDe = (regra: string) => PERMISSOES[regra.startsWith("alerta_") ? "alerta" : regra];
const safeUrl = (u: string | null | undefined) => (u && /^https:\/\//.test(u) ? u : null);
type Cobertura = { status: keyof typeof COB_TONE; motivo?: string };
type Conexao = { id: string; provider: string; settings: { tenant_id?: string; risk_coverage?: { at: string; rules: Record<string, Cobertura> } } | null };
const ESTADO_TONE = { aberta: "warning", aceita: "primary", descartada: "neutral", corrigida: "success" } as const;

export function RiscosSugeridos() {
  const { t, locale } = useLanguage();
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState<Sugestao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ate, setAte] = useState("");
  const [salvando, setSalvando] = useState<"aceitar" | "descartar" | null>(null);

  const key = ["riscos-sugeridos", empresaId];
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: key, enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("integracao_riscos_sugeridos" as never)
        .select("id,provider,regra_id,estado,evidencia,probabilidade,impacto,relevancia,alcance,risco_id,motivo_descarte,ultima_deteccao,corrigida_em,fonte,severidade_tecnica,recorrencias,suprimido_ate")
        .eq("empresa_id", empresaId).order("relevancia", { ascending: false }).order("ultima_deteccao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sugestao[];
    },
  });

  const { data: conexoes = [] } = useQuery({
    queryKey: ["riscos-sugeridos-cobertura", empresaId], enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_connections").select("id,provider,settings")
        .eq("empresa_id", empresaId!).in("provider", ["google_workspace", "microsoft"])
        .in("status", ["authorized", "connected", "partial"]);
      if (error) throw error;
      // A Microsoft connection without consented tenant is not real coverage.
      return ((data ?? []) as unknown as Conexao[]).filter((c) => c.provider !== "microsoft" || !!c.settings?.tenant_id);
    },
  });
  const [verificando, setVerificando] = useState(false);
  const verificarAgora = async () => {
    setVerificando(true);
    let falhas = 0;
    for (const c of conexoes) {
      const { error } = await invokeEdgeFunction("integration-connect", { body: { action: "collect", connection_id: c.id }, showToast: false });
      if (error) falhas++;
    }
    setVerificando(false);
    if (falhas) toast.error(t("riscosSugeridos.verificarFalha"));
    else toast.success(t("riscosSugeridos.verificarOk"));
    window.setTimeout(() => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("riscos-sugeridos") }), 15000);
  };
  const avaliadas = conexoes.some((c) => Object.values(c.settings?.risk_coverage?.rules ?? {}).some((r) => r.status === "ok"));
  const vazio = conexoes.length === 0
    ? { title: t("riscosSugeridos.vazioSemConexao"), description: t("riscosSugeridos.vazioDesc") }
    : avaliadas
      ? { title: t("riscosSugeridos.vazio"), description: t("riscosSugeridos.vazioAvaliadoDesc") }
      : { title: t("riscosSugeridos.vazioNaoAvaliado"), description: t("riscosSugeridos.vazioNaoAvaliadoDesc") };
  const rotuloCheck = (r: string) => {
    const k = `riscosSugeridos.regras.${r}.titulo`; const v = t(k);
    return v === k ? t(`riscosSugeridos.cobertura.checks.${r}`) : v;
  };

  const titulo = (s: Sugestao) => t(`riscosSugeridos.regras.${s.regra_id}.titulo`);
  const descricao = (s: Sugestao) => t(`riscosSugeridos.regras.${s.regra_id}.descricao`);
  const fmt = (d: string) => new Date(d).toLocaleDateString(String(locale).startsWith("en") ? "en-GB" : "pt-BR");

  const columns = useMemo<Column<Sugestao>[]>(() => [
    { key: "regra_id", label: t("riscosSugeridos.colRisco"), sortable: true, render: (_v, s) => titulo(s), sortAccessor: titulo },
    { key: "provider", label: t("riscosSugeridos.colOrigem"), render: (_v, s) => (
      <span className="inline-flex items-center gap-2"><img src={logoOf(s.provider).src} alt="" className="h-4 w-4" />{logoOf(s.provider).nome}</span>) },
    { key: "afetados", label: t("riscosSugeridos.colAfetados"), sortable: true, sortAccessor: (s) => s.evidencia?.total ?? 0, render: (_v, s) => s.evidencia?.total ?? "—" },
    { key: "severidade_tecnica", label: t("riscosSugeridos.colSeveridade"), sortable: true, sortAccessor: (s) => SEV_ORDER[s.severidade_tecnica ?? ""] ?? 0, render: (_v, s) =>
      s.severidade_tecnica ? <StatusBadge mark="severity" tone={SEV_TONE[s.severidade_tecnica] ?? "neutral"}>{t(`riscosSugeridos.severidades.${s.severidade_tecnica}`)}</StatusBadge> : "—" },
    { key: "relevancia", label: t("riscosSugeridos.colRelevancia"), sortable: true, sortAccessor: (s) => s.relevancia ?? 0, render: (_v, s) => s.relevancia ?? 0 },
    { key: "estado", label: t("riscosSugeridos.colEstado"), sortable: true, render: (_v, s) => <StatusBadge tone={ESTADO_TONE[s.estado]}>{t(`riscosSugeridos.estados.${s.estado}`)}</StatusBadge> },
    { key: "ultima_deteccao", label: t("riscosSugeridos.colDetectado"), sortable: true, kind: "date", render: (v) => fmt(v) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, locale]);

  const fechar = () => { setAberta(null); setMotivo(""); setAte(""); };
  const aceitar = async () => {
    if (!aberta) return;
    setSalvando("aceitar");
    const { data: riscoId, error } = await supabase.rpc("aceitar_risco_sugerido" as never, {
      p_id: aberta.id, p_nome: titulo(aberta),
      p_descricao: [descricao(aberta), `${aberta.fonte ?? logoOf(aberta.provider).nome}: ${(aberta.evidencia?.itens ?? []).join(", ")}`,
        ...(aberta.evidencia?.refs ?? []).map((r) => safeUrl(r.url)).filter(Boolean)].join("\n\n"),
    } as never);
    setSalvando(null);
    if (error) { logger.error("aceitar_risco_sugerido", error); toast.error(t("riscosSugeridos.erro")); return; }
    toast.success(t("riscosSugeridos.aceito"));
    fechar(); qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["riscos"] });
    if (riscoId) navigate(`/riscos?view=table&risco=${riscoId}`);
  };
  const descartar = async () => {
    if (!aberta || !motivo.trim()) return;
    setSalvando("descartar");
    const { error } = await supabase.rpc("descartar_risco_sugerido" as never, { p_id: aberta.id, p_motivo: motivo.trim(), p_ate: ate || null } as never);
    setSalvando(null);
    if (error) { logger.error("descartar_risco_sugerido", error); toast.error(t("riscosSugeridos.erro")); return; }
    toast.success(t("riscosSugeridos.descartado"));
    fechar(); qc.invalidateQueries({ queryKey: key });
  };

  const itens = aberta?.evidencia?.itens ?? [];
  const resto = (aberta?.evidencia?.total ?? 0) - itens.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("riscosSugeridos.intro")}</p>
        {conexoes.length > 0 && (
          <Button variant="outline" size="sm" loading={verificando} onClick={verificarAgora}>{t("riscosSugeridos.verificarAgora")}</Button>
        )}
      </div>
      {conexoes.length > 0 && (
        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("riscosSugeridos.cobertura.titulo")}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{t("riscosSugeridos.cobertura.intro")}</p>
          <div className="mt-3 space-y-4">
            {conexoes.map((c) => {
              const cob = c.settings?.risk_coverage;
              const faltam = [...new Set(Object.entries(cob?.rules ?? {}).filter(([, v]) => v.status === "permission_missing").map(([r]) => permissaoDe(r)).filter(Boolean))];
              return (
                <div key={c.id}>
                  <p className="mb-1 flex items-center gap-2 font-medium"><img src={logoOf(c.provider).src} alt="" className="h-4 w-4" />{logoOf(c.provider).nome}
                    <span className="text-xs font-normal text-muted-foreground">{cob ? t("riscosSugeridos.cobertura.em", { data: new Date(cob.at).toLocaleString(String(locale).startsWith("en") ? "en-GB" : "pt-BR") }) : t("riscosSugeridos.cobertura.semColeta")}</span></p>
                  {cob && (
                    <ul className="space-y-1">
                      {Object.entries(cob.rules).map(([r, v]) => (
                        <li key={r} className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={COB_TONE[v.status] ?? "neutral"}>{t(`riscosSugeridos.cobertura.status.${v.status}`)}</StatusBadge>
                          <span>{rotuloCheck(r)}</span>
                          {v.motivo && <span className="text-xs text-muted-foreground">· {t(`riscosSugeridos.cobertura.motivos.${v.motivo.split(":")[0]}`)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {faltam.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">{t("riscosSugeridos.cobertura.permissoes")} {faltam.join("; ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
      <DataTable
        data={data} columns={columns} loading={isLoading} error={isError} onRefresh={() => refetch()}
        exportName="riscos-sugeridos" onRowClick={(s) => setAberta(s)}
        emptyState={vazio}
      />
      {aberta && (
        <DialogShell
          open onOpenChange={(o) => !o && fechar()} variant="side"
          eyebrow={logoOf(aberta.provider).nome} title={titulo(aberta)} description={descricao(aberta)}
          footer={aberta.estado === "aberta" ? (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={descartar} disabled={!motivo.trim()} loading={salvando === "descartar"}>{t("riscosSugeridos.descartar")}</Button>
              <Button onClick={aceitar} loading={salvando === "aceitar"}>{t("riscosSugeridos.aceitar")}</Button>
            </div>
          ) : aberta.risco_id ? (
            <div className="flex w-full justify-end"><Button variant="outline" onClick={() => navigate(`/riscos?view=table&risco=${aberta.risco_id}`)}>{t("riscosSugeridos.verRisco")}</Button></div>
          ) : <span />}
        >
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={ESTADO_TONE[aberta.estado]}>{t(`riscosSugeridos.estados.${aberta.estado}`)}</StatusBadge>
              {aberta.severidade_tecnica && <StatusBadge mark="severity" tone={SEV_TONE[aberta.severidade_tecnica] ?? "neutral"}>{t("riscosSugeridos.severidadeTecnica")}: {t(`riscosSugeridos.severidades.${aberta.severidade_tecnica}`)}</StatusBadge>}
              <span className="text-muted-foreground">{t("riscosSugeridos.colRelevancia")}: {aberta.relevancia ?? 0}</span>
              {aberta.fonte && <span className="text-muted-foreground">· {t("riscosSugeridos.fonte")}: {aberta.fonte}</span>}
              <span className="text-muted-foreground">· {t("riscosSugeridos.colDetectado")}: {fmt(aberta.ultima_deteccao)}</span>
              {aberta.recorrencias > 0 && <span className="text-muted-foreground">· {t("riscosSugeridos.recorrencias", { n: aberta.recorrencias })}</span>}
            </div>
            <p className="text-xs text-muted-foreground">{t("riscosSugeridos.prioridadeNota")}</p>
            {aberta.corrigida_em && <p className="text-success">{t("riscosSugeridos.corrigidoEm", { data: fmt(aberta.corrigida_em) })}</p>}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("riscosSugeridos.afetados", { n: aberta.evidencia?.total ?? 0 })}</p>
              {aberta.evidencia?.refs?.length ? (
                <ul className="space-y-1">{aberta.evidencia.refs.map((r) => (
                  <li key={r.id} className="truncate">{safeUrl(r.url)
                    ? <a href={safeUrl(r.url)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{r.nome}</a> : r.nome}</li>))}</ul>
              ) : <ul className="space-y-1">{itens.map((x) => <li key={x} className="truncate">{x}</li>)}</ul>}
              {resto > 0 && <p className="mt-1 text-muted-foreground">{t("riscosSugeridos.maisItens", { n: resto })}</p>}
            </div>
            {aberta.evidencia?.alvos?.length ? (
              <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("riscosSugeridos.alvos")}</p>
                <p className="text-muted-foreground">{aberta.evidencia.alvos.join(", ")}</p></div>) : null}
            {aberta.alcance && Object.keys(aberta.alcance).length > 0 && (
              <p className="text-xs text-muted-foreground">{t("riscosSugeridos.alcance")}: {Object.entries(aberta.alcance).map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.length : String(v)}`).join(" · ")}</p>)}
            {aberta.motivo_descarte && <p className="text-muted-foreground">{aberta.motivo_descarte}</p>}
            {aberta.estado === "aberta" && (
              <div className="space-y-2">
                <Label htmlFor="motivo-descarte">{t("riscosSugeridos.motivo")}</Label>
                <Textarea id="motivo-descarte" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("riscosSugeridos.motivoPh")} maxLength={1000} />
                <Label htmlFor="ate-descarte">{t("riscosSugeridos.suprimirAte")}</Label>
                <Input id="ate-descarte" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-full" />
                <p className="text-xs text-muted-foreground">{t("riscosSugeridos.suprimirAteDesc")}</p>
              </div>
            )}
          </div>
        </DialogShell>
      )}
    </div>
  );
}
