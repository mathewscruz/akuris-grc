import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IconAdd, IconDelete, IconScale } from "@/components/icons";
import type { BaseLegalEntrada } from "@/hooks/useRopaBasesLegais";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  value: BaseLegalEntrada[];
  onChange: (value: BaseLegalEntrada[]) => void;
  options: { key: string; label: string }[];
  disabled?: boolean;
}

const vazia = (): BaseLegalEntrada => ({
  base_legal: "",
  justificativa: "",
  abrangencia: "",
});

export function BasesLegaisEditor({
  value,
  onChange,
  options,
  disabled = false,
}: Props) {
  const { t } = useLanguage();
  const alterar = (
    index: number,
    field: keyof BaseLegalEntrada,
    next: string,
  ) =>
    onChange(
      value.map((base, i) => (i === index ? { ...base, [field]: next } : base)),
    );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <IconScale className="h-4 w-4 text-primary" />
            {t("privacidadePrograma.bases.titulo")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("privacidadePrograma.bases.descricao")}
          </p>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...value, vazia()])}
          >
            <IconAdd className="mr-1.5 h-4 w-4" />{" "}
            {t("privacidadePrograma.bases.adicionar")}
          </Button>
        )}
      </div>

      {value.map((base, index) => (
        <div
          key={`${index}-${base.base_legal}`}
          className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label>{t("privacidadePrograma.bases.base")}</Label>
            <Select
              value={base.base_legal}
              onValueChange={(v) => alterar(index, "base_legal", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("privacidadePrograma.bases.selecione")}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("privacidadePrograma.bases.abrangencia")}</Label>
            <Input
              value={base.abrangencia || ""}
              disabled={disabled}
              onChange={(e) => alterar(index, "abrangencia", e.target.value)}
              placeholder={t(
                "privacidadePrograma.bases.abrangenciaPlaceholder",
              )}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t("privacidadePrograma.bases.justificativa")}</Label>
            <div className="flex items-start gap-2">
              <Textarea
                value={base.justificativa || ""}
                disabled={disabled}
                onChange={(e) =>
                  alterar(index, "justificativa", e.target.value)
                }
                placeholder={t(
                  "privacidadePrograma.bases.justificativaPlaceholder",
                )}
                rows={2}
              />
              {!disabled && value.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  aria-label={t("common.delete")}
                >
                  <IconDelete className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
