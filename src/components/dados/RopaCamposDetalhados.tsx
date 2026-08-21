import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { textoDaVariante } from "@/lib/pt-variants";
import { formatStatus } from "@/lib/text-utils";
import { ROPA_SECTIONS, ropaFieldsBySection, type RopaFieldDef } from "@/lib/ropa-schema";
import { useMatrizConfigEmpresa } from "@/hooks/useMatrizConfigEmpresa";
import { nivelRiscoFromConfig } from "@/components/riscos/matriz-config";
import { severidadeDeFaixas } from "@/lib/metrics/riscos";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveNivelRiscoTone } from "@/lib/status-tone";

/** Campos já cobertos pelo formulário base do ROPA. */
const CAMPOS_BASE = new Set([
  "nome_tratamento",
  "finalidade",
  "base_legal",
  "categoria_titulares",
  "prazo_retencao",
  "medidas_seguranca",
  "responsavel_tratamento",
  "encarregado_dados",
  "observacoes",
]);

interface Props {
  values: Record<string, any>;
  onChange: (key: string, value: string) => void;
}

export function RopaCamposDetalhados({ values, onChange }: Props) {
  const { locale } = useLanguage();
  /** Rótulo do esquema já na variante activa — ver `textoDaVariante`. */
  const rotulo = (par: { pt: string; en: string }) => textoDaVariante(String(locale), par);


  const { data: matriz } = useMatrizConfigEmpresa();

  /** A escala do eixo certo, com fallback de 5 níveis sem matriz configurada. */
  const escalaDoCampo = (key: string) => {
    const escala =
      key === 'risco_probabilidade' ? matriz?.escala_probabilidade : matriz?.escala_impacto;
    if (escala && escala.length > 0) return escala;
    return Array.from({ length: 5 }, (_, k) => ({ valor: String(k + 1), descricao: '' }));
  };

  /** Pré-visualização do nível; o valor gravado vem do trigger do banco. */
  const nivelCalculado = nivelRiscoFromConfig(
    values.risco_probabilidade,
    values.risco_impacto,
    matriz,
  );

  const renderField = (field: RopaFieldDef) => {
    const value = values[field.key] ?? "";
    const label = rotulo(field.label);
    const hint = rotulo(field.hint);

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={`ropa-${field.key}`}>{label}</Label>
        {field.type === "escala" ? (
          /*
            Escala da matriz da empresa, com os rótulos que ela configurou —
            os mesmos que o formulário de risco apresenta. Antes eram quatro
            palavras fixas ("baixo/medio/alto/critico") sem relação nenhuma
            com a matriz, e o utilizador escolhia também o NÍVEL à mão.
          */
          <Select
            value={value ? String(value) : undefined}
            onValueChange={(v) => onChange(field.key, v)}
          >
            <SelectTrigger id={`ropa-${field.key}`}>
              <SelectValue placeholder={hint} />
            </SelectTrigger>
            <SelectContent>
              {escalaDoCampo(field.key).map((item, idx) => (
                <SelectItem key={item.valor || idx} value={String(idx + 1)}>
                  {idx + 1}{item.descricao ? ` - ${item.descricao}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "derivado" ? (
          <div
            id={`ropa-${field.key}`}
            className="h-10 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 text-sm"
          >
            {nivelCalculado ? (
              <>
                <StatusBadge {...resolveNivelRiscoTone(severidadeDeFaixas(nivelCalculado, matriz?.niveis_risco))}>
                  {nivelCalculado}
                </StatusBadge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  P{values.risco_probabilidade} × I{values.risco_impacto}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{hint}</span>
            )}
          </div>
        ) : field.type === "select" ? (
          <Select value={value || undefined} onValueChange={(v) => onChange(field.key, v)}>
            <SelectTrigger id={`ropa-${field.key}`}>
              <SelectValue placeholder={hint} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {/* `formatStatus` é o tradutor único de valores de domínio.
                      Aqui havia dois mapas à mão para os mesmos quatro níveis,
                      que já divergiam do resto do produto. */}
                  {formatStatus(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "textarea" ? (
          <Textarea
            id={`ropa-${field.key}`}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={hint}
            rows={3}
          />
        ) : (
          <Input
            id={`ropa-${field.key}`}
            value={value}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={hint}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {ROPA_SECTIONS.map((section) => {
        const fields = ropaFieldsBySection(section.key).filter((f) => !CAMPOS_BASE.has(f.key));
        if (fields.length === 0) return null;
        return (
          <div key={section.key} className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {rotulo(section.label)}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : undefined}>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
