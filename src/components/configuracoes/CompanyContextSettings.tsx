import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "@/lib/toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  MOEDAS,
  SIMBOLO_MOEDA,
  type MoedaCodigo,
} from "@/hooks/useEmpresaMoeda";
import {
  JURISDICOES,
  inferirJurisdicao,
  type JurisdicaoCodigo,
} from "@/lib/jurisdicao";
import { useQueryClient } from "@tanstack/react-query";

import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { IconOrg, IconSave } from "@/components/icons";
const SETOR_OPTIONS: { value: string; key: string }[] = [
  { value: "Financeiro / Bancário", key: "financeiro" },
  { value: "Saúde", key: "saude" },
  { value: "Tecnologia", key: "tecnologia" },
  { value: "Varejo / E-commerce", key: "varejo" },
  { value: "Indústria / Manufatura", key: "industria" },
  { value: "Educação", key: "educacao" },
  { value: "Governo / Setor Público", key: "governo" },
  { value: "Telecomunicações", key: "telecom" },
  { value: "Energia / Utilities", key: "energia" },
  { value: "Logística / Transporte", key: "logistica" },
  { value: "Agronegócio", key: "agronegocio" },
  { value: "Jurídico / Advocacia", key: "juridico" },
  { value: "Seguros", key: "seguros" },
  { value: "Outro", key: "outro" },
];

const PORTE_KEYS = [
  "micro",
  "pequena",
  "media",
  "grande",
  "enterprise",
] as const;

/**
 * `setor_atuacao` e `porte_empresa` são texto livre, sem CHECK e sem vocabulário
 * partilhado — foram escritos ao longo do tempo por este formulário e por
 * provisionamentos. O banco local, por exemplo, guarda `Industria` e `medio`,
 * que não batem com `Indústria / Manufatura` nem com `media`.
 *
 * O Radix só mostra o placeholder quando o valor é vazio: com um valor que não
 * casa com nenhum item, ele pinta o gatilho EM BRANCO. Ou seja, o setor e o
 * porte da empresa simplesmente desapareciam da tela — enquanto continuavam a
 * ser enviados para a IA do gerador de documentos.
 *
 * Casamos sem acento e sem caixa; o que não casar continua visível como está,
 * porque mostrar um valor estranho é sempre melhor do que mostrar nada.
 */
/** Compara ignorando acento e caixa — 'Industria' casa com 'Indústria'. */
const mesmoTermo = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), "pt", { sensitivity: "base" }) === 0;

function casarComOpcao(valor: string, opcoes: string[]): string | null {
  if (!valor) return null;
  const exato = opcoes.find((o) => mesmoTermo(o, valor));
  if (exato) return exato;
  // 'Industria' ⇄ 'Indústria / Manufatura': casa pelo primeiro termo antes da barra.
  return opcoes.find((o) => mesmoTermo(o.split(" / ")[0], valor)) ?? null;
}

export function CompanyContextSettings() {
  const { t, locale } = useLanguage();
  const { empresaId } = useEmpresaId();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [setor, setSetor] = useState("");
  const [porte, setPorte] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");
  const [moeda, setMoeda] = useState<MoedaCodigo>("EUR");
  const [jurisdicao, setJurisdicao] = useState<JurisdicaoCodigo>(() =>
    inferirJurisdicao(locale),
  );
  const [agentePequenoPorte, setAgentePequenoPorte] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    const load = async () => {
      setFetching(true);
      const { data } = await supabase
        .from("empresas")
        .select(
          "setor_atuacao, porte_empresa, objetivo_compliance, data_alvo_certificacao, moeda, jurisdicao, agente_tratamento_pequeno_porte",
        )
        .eq("id", empresaId)
        .single();
      if (data) {
        const setorBruto = (data as any).setor_atuacao || "";
        const porteBruto = (data as any).porte_empresa || "";
        setSetor(
          casarComOpcao(
            setorBruto,
            SETOR_OPTIONS.map((o) => o.value),
          ) ?? setorBruto,
        );
        setPorte(casarComOpcao(porteBruto, [...PORTE_KEYS]) ?? porteBruto);
        setObjetivo((data as any).objetivo_compliance || "");
        setDataAlvo((data as any).data_alvo_certificacao || "");
        setMoeda(((data as any).moeda as MoedaCodigo) || "EUR");
        setJurisdicao(
          ((data as any).jurisdicao as JurisdicaoCodigo) ||
            inferirJurisdicao(locale),
        );
        setAgentePequenoPorte(
          Boolean((data as any).agente_tratamento_pequeno_porte),
        );
      }
      setFetching(false);
    };
    load();
  }, [empresaId]);

  const handleSave = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("empresas")
        .update({
          setor_atuacao: setor || null,
          porte_empresa: porte || null,
          objetivo_compliance: objetivo || null,
          data_alvo_certificacao: dataAlvo || null,
          moeda,
          jurisdicao,
          agente_tratamento_pequeno_porte: agentePequenoPorte,
        } as any)
        .eq("id", empresaId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["empresa-moeda"] });
      queryClient.invalidateQueries({ queryKey: ["empresa-jurisdicao"] });
      toast.success(t("configGeral.companyContext.toastSaved"));
    } catch {
      toast.error(t("configGeral.companyContext.toastError"));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <AkurisPulse size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <IconOrg className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold text-base">
            {t("configGeral.companyContext.title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("configGeral.companyContext.description")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("configGeral.companyContext.labelSetor")}</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("configGeral.companyContext.placeholderSetor")}
              />
            </SelectTrigger>
            <SelectContent>
              {/* Um valor gravado fora da lista precisa de item próprio, senão o
                  gatilho fica em branco e o setor da empresa some da tela. */}
              {setor && !SETOR_OPTIONS.some((o) => o.value === setor) && (
                <SelectItem value={setor}>{setor}</SelectItem>
              )}
              {SETOR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(`configGeral.companyContext.setores.${opt.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("configGeral.companyContext.labelPorte")}</Label>
          <Select value={porte} onValueChange={setPorte}>
            <SelectTrigger>
              <SelectValue
                placeholder={t("configGeral.companyContext.placeholderPorte")}
              />
            </SelectTrigger>
            <SelectContent>
              {porte && !PORTE_KEYS.some((k) => k === porte) && (
                <SelectItem value={porte}>{porte}</SelectItem>
              )}
              {PORTE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`configGeral.companyContext.portes.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("configGeral.companyContext.labelMoeda")}</Label>
          <Select
            value={moeda}
            onValueChange={(v) => setMoeda(v as MoedaCodigo)}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t("configGeral.companyContext.placeholderMoeda")}
              />
            </SelectTrigger>
            <SelectContent>
              {MOEDAS.map((code) => (
                <SelectItem
                  key={code}
                  value={code}
                >{`${code} (${SIMBOLO_MOEDA[code]})`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("configGeral.companyContext.descricaoMoeda")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("jurisdicao.label")}</Label>
          <Select
            value={jurisdicao}
            onValueChange={(v) => setJurisdicao(v as JurisdicaoCodigo)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("jurisdicao.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {JURISDICOES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`jurisdicao.opcoes.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("jurisdicao.descricao")}
          </p>
        </div>

        {jurisdicao === "BR" && (
          <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4 md:col-span-2">
            <Checkbox
              className="mt-0.5"
              checked={agentePequenoPorte}
              onCheckedChange={(value) => setAgentePequenoPorte(value === true)}
            />
            <span>
              <span className="block text-sm font-medium">
                {t("configGeral.companyContext.agentePequenoPorte")}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t("configGeral.companyContext.agentePequenoPorteDescricao")}
              </span>
            </span>
          </label>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label>{t("configGeral.companyContext.labelObjetivo")}</Label>
          <Textarea
            placeholder={t("configGeral.companyContext.placeholderObjetivo")}
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("configGeral.companyContext.labelDataAlvo")}</Label>
          <DateField
            value={dataAlvo || null}
            onChange={(v) => setDataAlvo(v || "")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          <IconSave className="h-4 w-4 mr-2" />
          {loading
            ? t("configGeral.companyContext.saving")
            : t("configGeral.companyContext.saveButton")}
        </Button>
      </div>
    </div>
  );
}
