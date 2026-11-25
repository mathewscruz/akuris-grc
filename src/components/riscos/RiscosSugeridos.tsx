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

type Sugestao = {
  id: string; provider: string; regra_id: string; estado: "aberta" | "aceita" | "descartada" | "corrigida";
  evidencia: { total?: number; itens?: string[] }; probabilidade: number; impacto: number;
  risco_id: string | null; motivo_descarte: string | null; ultima_deteccao: string; corrigida_em: string | null;
  fonte: string | null; severidade_tecnica: string | null; recorrencias: number; suprimido_ate: string | null;
};

const LOGO: Record<string, { src: string; nome: string }> = {
  google_workspace: { src: "/integrations/google-workspace.svg", nome: "Google Workspace" },
  microsoft: { src: "/integrations/microsoft365.svg", nome: "Microsoft 365" },
};
const logoOf = (p: string) => LOGO[p] ?? LOGO.microsoft;

export function nivelSugerido(p: number, i: number) {
  const s = p * i;
  return s >= 20 ? "critico" : s >= 12 ? "alto" : s >= 6 ? "medio" : "baixo";
}
const NIVEL_TONE = { critico: "destructive", alto: "warning", medio: "info", baixo: "neutral" } as const;
const NIVEL_LABEL: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Médio", baixo: "Baixo" };
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
        .select("id,provider,regra_id,estado,evidencia,probabilidade,impacto,risco_id,motivo_descarte,ultima_deteccao,corrigida_em,fonte,severidade_tecnica,recorrencias,suprimido_ate")
        .eq("empresa_id", empresaId).order("ultima_deteccao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Sugestao[];
    },
  });

  const titulo = (s: Sugestao) => t(`riscosSugeridos.regras.${s.regra_id}.titulo`);
  const descricao = (s: Sugestao) => t(`riscosSugeridos.regras.${s.regra_id}.descricao`);
  const fmt = (d: string) => new Date(d).toLocaleDateString(String(locale).startsWith("en") ? "en-GB" : "pt-BR");

  const columns = useMemo<Column<Sugestao>[]>(() => [
    { key: "regra_id", label: t("riscosSugeridos.colRisco"), sortable: true, render: (_v, s) => titulo(s), sortAccessor: titulo },
    { key: "provider", label: t("riscosSugeridos.colOrigem"), render: (_v, s) => (
      <span className="inline-flex items-center gap-2"><img src={logoOf(s.provider).src} alt="" className="h-4 w-4" />{logoOf(s.provider).nome}</span>) },
    { key: "afetados", label: t("riscosSugeridos.colAfetados"), sortable: true, sortAccessor: (s) => s.evidencia?.total ?? 0, render: (_v, s) => s.evidencia?.total ?? "—" },
    { key: "nivel", label: t("riscosSugeridos.colNivel"), sortable: true, sortAccessor: (s) => s.probabilidade * s.impacto, render: (_v, s) => {
      const n = nivelSugerido(s.probabilidade, s.impacto);
      return <StatusBadge mark="severity" tone={NIVEL_TONE[n]}>{NIVEL_LABEL[n]}</StatusBadge>;
    } },
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
      p_descricao: `${descricao(aberta)}\n\n${logoOf(aberta.provider).nome}: ${(aberta.evidencia?.itens ?? []).join(", ")}`,
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
      <p className="text-sm text-muted-foreground">{t("riscosSugeridos.intro")}</p>
      <DataTable
        data={data} columns={columns} loading={isLoading} error={isError} onRefresh={() => refetch()}
        exportName="riscos-sugeridos" onRowClick={(s) => setAberta(s)}
        emptyState={{ title: t("riscosSugeridos.vazio"), description: t("riscosSugeridos.vazioDesc") }}
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
              <StatusBadge mark="severity" tone={NIVEL_TONE[nivelSugerido(aberta.probabilidade, aberta.impacto)]}>{NIVEL_LABEL[nivelSugerido(aberta.probabilidade, aberta.impacto)]}</StatusBadge>
              <span className="text-muted-foreground">{t("riscosSugeridos.probImpacto", { p: aberta.probabilidade, i: aberta.impacto })}</span>
              {aberta.fonte && <span className="text-muted-foreground">· {t("riscosSugeridos.fonte")}: {aberta.fonte}</span>}
              {aberta.severidade_tecnica && <span className="text-muted-foreground">· {t("riscosSugeridos.severidadeTecnica")}: {t(`riscosSugeridos.severidades.${aberta.severidade_tecnica}`)}</span>}
              {aberta.recorrencias > 0 && <span className="text-muted-foreground">· {t("riscosSugeridos.recorrencias", { n: aberta.recorrencias })}</span>}
            </div>
            {aberta.corrigida_em && <p className="text-success">{t("riscosSugeridos.corrigidoEm", { data: fmt(aberta.corrigida_em) })}</p>}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("riscosSugeridos.afetados", { n: aberta.evidencia?.total ?? 0 })}</p>
              <ul className="space-y-1">{itens.map((x) => <li key={x} className="truncate">{x}</li>)}</ul>
              {resto > 0 && <p className="mt-1 text-muted-foreground">{t("riscosSugeridos.maisItens", { n: resto })}</p>}
            </div>
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
