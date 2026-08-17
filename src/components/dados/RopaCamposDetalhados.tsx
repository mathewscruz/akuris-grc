import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { ROPA_SECTIONS, ropaFieldsBySection, type RopaFieldDef } from "@/lib/ropa-schema";

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
  const { language } = useLanguage();
  const lang = language?.startsWith("en") ? "en" : "pt";

  const renderField = (field: RopaFieldDef) => {
    const value = values[field.key] ?? "";
    const label = field.label[lang];
    const hint = field.hint[lang];

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={`ropa-${field.key}`}>{label}</Label>
        {field.type === "select" ? (
          <Select value={value || undefined} onValueChange={(v) => onChange(field.key, v)}>
            <SelectTrigger id={`ropa-${field.key}`}>
              <SelectValue placeholder={hint} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {lang === "en"
                    ? { baixo: "Low", medio: "Medium", alto: "High", critico: "Critical" }[option] ?? option
                    : { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" }[option] ?? option}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label[lang]}
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
