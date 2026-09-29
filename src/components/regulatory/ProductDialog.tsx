import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  productDraftSchema,
  productVersionDraftSchema,
  type ProductDraft,
  type ProductVersionDraft,
} from "@/lib/regulatory/models";
import {
  regulatoryDb as db,
  type Product,
  type ProductVersion,
} from "@/lib/regulatory/types";
import { useCraText } from "@/hooks/useRegulatoryText";
import { Choice, Field } from "./shared";

type Person = { id: string; nome: string };
export function ProductDialog({
  empresaId,
  product,
  people,
  onClose,
  onSaved,
}: {
  empresaId: string;
  product?: Product;
  people: Person[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label } = useCraText();
  const [value, setValue] = useState<ProductDraft>(() =>
    product
      ? productDraftSchema.parse({
          name: product.name,
          product_type: product.product_type,
          description: product.description,
          product_owner_id: product.product_owner_id,
          security_owner_id: product.security_owner_id,
          development_team: product.development_team,
          deployment_model: product.deployment_model,
          repositories: product.repositories,
          markets: product.markets,
          eu_availability: product.eu_availability,
          status: product.status,
        })
      : {
          ...productDraftSchema.parse({
            name: "draft",
            product_type: "software",
          }),
          name: "",
        },
  );
  const [repositories, setRepositories] = useState(
    product?.repositories.join("\n") ?? "",
  );
  const [markets, setMarkets] = useState(product?.markets.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof ProductDraft>(key: K, v: ProductDraft[K]) =>
    setValue((old) => ({ ...old, [key]: v }));
  const owners = [
    { value: "none", label: text("regulatory.unassigned_9dc70f") },
    ...people.map((p) => ({ value: p.id, label: p.nome })),
  ];
  async function save() {
    setError("");
    const parsed = productDraftSchema.safeParse({
      ...value,
      repositories: repositories
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      markets: markets
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setError(
        text(
          "regulatory.check_the_fields_a_name_is_required_repository_u_e2bf89",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      const result = product
        ? await db
            .from("products")
            .update(parsed.data)
            .eq("id", product.id)
            .eq("empresa_id", empresaId)
            .select("id")
            .single()
        : await db
            .from("products")
            .insert({ ...parsed.data, empresa_id: empresaId })
            .select("id")
            .single();
      if (result.error) throw result.error;
      await onSaved();
      onClose();
    } catch {
      setError(
        text(
          "regulatory.could_not_save_check_your_permissions_and_try_ag_3f7184",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {product
              ? text("regulatory.edit_product_6ef595")
              : text("regulatory.add_product_88d591")}
          </DialogTitle>
          <DialogDescription>
            {text(
              "regulatory.your_session_defines_the_organization_versions_a_5a6b54",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <Field
              id="product-name"
              label={text("regulatory.product_name_32f034")}
            >
              <Input
                id="product-name"
                value={value.name}
                maxLength={200}
                required
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field id="product-type" label={text("regulatory.type_294307")}>
              <Choice
                id="product-type"
                value={value.product_type}
                onChange={(v) =>
                  set("product_type", v as ProductDraft["product_type"])
                }
                options={["software", "hardware", "combined", "other"].map(
                  (v) => ({ value: v, label: label(v) }),
                )}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="product-description"
                label={text(
                  "regulatory.description_and_core_functionality_affb73",
                )}
              >
                <Textarea
                  id="product-description"
                  value={value.description}
                  maxLength={12000}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
            <Field
              id="product-owner"
              label={text("regulatory.product_owner_d641ab")}
            >
              <Choice
                id="product-owner"
                value={value.product_owner_id ?? "none"}
                onChange={(v) =>
                  set("product_owner_id", v === "none" ? null : v)
                }
                options={owners}
              />
            </Field>
            <Field
              id="security-owner"
              label={text("regulatory.security_owner_a7cc61")}
            >
              <Choice
                id="security-owner"
                value={value.security_owner_id ?? "none"}
                onChange={(v) =>
                  set("security_owner_id", v === "none" ? null : v)
                }
                options={owners}
              />
            </Field>
            <Field
              id="product-team"
              label={text("regulatory.development_team_be4ce0")}
            >
              <Input
                id="product-team"
                value={value.development_team}
                maxLength={500}
                onChange={(e) => set("development_team", e.target.value)}
              />
            </Field>
            <Field
              id="product-deployment"
              label={text("regulatory.deployment_model_88e616")}
            >
              <Choice
                id="product-deployment"
                value={value.deployment_model}
                onChange={(v) =>
                  set("deployment_model", v as ProductDraft["deployment_model"])
                }
                options={[
                  "unknown",
                  "on_premise",
                  "cloud",
                  "hybrid",
                  "embedded",
                  "mobile",
                ].map((v) => ({ value: v, label: label(v) }))}
              />
            </Field>
            <Field
              id="product-markets"
              label={text("regulatory.markets_comma_separated_356a74")}
            >
              <Input
                id="product-markets"
                value={markets}
                onChange={(e) => setMarkets(e.target.value)}
              />
            </Field>
            <Field
              id="product-eu"
              label={text("regulatory.available_in_the_european_union_f26321")}
            >
              <Choice
                id="product-eu"
                value={value.eu_availability}
                onChange={(v) =>
                  set("eu_availability", v as ProductDraft["eu_availability"])
                }
                options={["unknown", "yes", "no"].map((v) => ({
                  value: v,
                  label: label(v),
                }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="product-repositories"
                label={text("regulatory.repositories_one_url_per_line_6bd099")}
                hint={text(
                  "regulatory.https_urls_only_without_tokens_passwords_or_quer_3f7f98",
                )}
              >
                <Textarea
                  id="product-repositories"
                  value={repositories}
                  onChange={(e) => setRepositories(e.target.value)}
                />
              </Field>
            </div>
            {product && (
              <Field
                id="product-state"
                label={text("regulatory.product_status_f7cc8b")}
              >
                <Choice
                  id="product-state"
                  value={value.status}
                  onChange={(v) => set("status", v as ProductDraft["status"])}
                  options={["active", "archived"].map((v) => ({
                    value: v,
                    label: label(v),
                  }))}
                />
              </Field>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              {text("regulatory.cancel_116461")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? text("regulatory.saving_126974")
                : text("regulatory.save_product_20e015")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductVersionDialog({
  empresaId,
  product,
  version,
  onClose,
  onSaved,
}: {
  empresaId: string;
  product: Product;
  version?: ProductVersion;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { text, label } = useCraText();
  const [value, setValue] = useState<ProductVersionDraft>(() => ({
    product_id: product.id,
    version: version?.version ?? "",
    release_date: version?.release_date ?? null,
    support_starts_on: version?.support_starts_on ?? null,
    support_ends_on: version?.support_ends_on ?? null,
    support_rationale: version?.support_rationale ?? "",
    lifecycle_status: version?.lifecycle_status ?? "development",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    const parsed = productVersionDraftSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        text(
          "regulatory.enter_a_version_and_check_the_release_and_suppor_2d0e47",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      const result = version
        ? await db
            .from("product_versions")
            .update(parsed.data)
            .eq("id", version.id)
            .eq("empresa_id", empresaId)
            .select("id")
            .single()
        : await db
            .from("product_versions")
            .insert({ ...parsed.data, empresa_id: empresaId })
            .select("id")
            .single();
      if (result.error) throw result.error;
      await onSaved();
      onClose();
    } catch {
      setError(
        text(
          "regulatory.could_not_save_the_version_may_already_exist_or__f6c685",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {text("regulatory.product_version_9ec6c8")} · {product.name}
          </DialogTitle>
          <DialogDescription>
            {text(
              "regulatory.the_version_identifier_cannot_be_overwritten_aft_470a08",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field id="version-name" label={text("regulatory.version_894061")}>
            <Input
              id="version-name"
              required
              maxLength={100}
              disabled={!!version || saving}
              value={value.version}
              onChange={(e) =>
                setValue((v) => ({ ...v, version: e.target.value }))
              }
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              ["release_date", "support_starts_on", "support_ends_on"] as const
            ).map((key, index) => (
              <Field
                key={key}
                id={key}
                label={
                  [
                    text("regulatory.release_date_ef1cc5"),
                    text("regulatory.support_starts_e98950"),
                    text("regulatory.support_ends_2409e2"),
                  ][index]
                }
              >
                <Input
                  id={key}
                  type="date"
                  disabled={saving}
                  value={value[key] ?? ""}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, [key]: e.target.value || null }))
                  }
                />
              </Field>
            ))}
            <Field
              id="version-status"
              label={text("regulatory.lifecycle_1aa427")}
            >
              <Choice
                id="version-status"
                disabled={saving}
                value={value.lifecycle_status}
                onChange={(v) =>
                  setValue((old) => ({
                    ...old,
                    lifecycle_status:
                      v as ProductVersionDraft["lifecycle_status"],
                  }))
                }
                options={[
                  "development",
                  "released",
                  "end_of_support",
                  "archived",
                ].map((v) => ({ value: v, label: label(v) }))}
              />
            </Field>
          </div>
          <Field
            id="support-rationale"
            label={text("regulatory.support_period_rationale_799cad")}
            hint={text(
              "regulatory.consider_expected_lifetime_obligations_and_appli_e2a257",
            )}
          >
            <Textarea
              id="support-rationale"
              value={value.support_rationale}
              disabled={saving}
              maxLength={4000}
              onChange={(e) =>
                setValue((v) => ({ ...v, support_rationale: e.target.value }))
              }
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {text("regulatory.cancel_116461")}
            </Button>
            <Button type="submit" disabled={saving}>
              {text("regulatory.save_version_527aa3")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
