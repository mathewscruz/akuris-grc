import { useMemo, useState } from "react";
import { IconCheck } from '@/components/icons';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
;
import { z } from "zod";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Translate = (key: string) => string;

const makeSchema = (d: Translate) =>
  z.object({
    name: z.string().trim().min(2, d("errNome")).max(120),
    role: z.string().trim().max(120).optional().or(z.literal("")),
    email: z.string().trim().email(d("errEmail")).max(200),
    company: z.string().trim().min(2, d("errEmpresa")).max(160),
    companySize: z.string().min(1, d("errTamanho")),
    message: z.string().trim().max(1000).optional().or(z.literal("")),
  });

export function DemoRequestDialog({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const d = useMemo<Translate>(() => (key: string) => t(`publico.demo.${key}`), [t]);

  const [phase, setPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [data, setData] = useState({ name: "", role: "", email: "", company: "", companySize: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");

  const sizes = useMemo(
    () => [
      { v: "", l: d("selecione") },
      { v: "1-50", l: d("tam1") },
      { v: "51-250", l: "51–250" },
      { v: "251-1000", l: "251–1.000" },
      { v: "1000+", l: d("tam4") },
    ],
    [d],
  );

  const reset = () => {
    setPhase("idle");
    setData({ name: "", role: "", email: "", company: "", companySize: "", message: "" });
    setErrors({});
    setHoneypot("");
  };

  const handleClose = (v: boolean) => {
    if (!v && phase === "success") setTimeout(reset, 250);
    onOpenChange(v);
  };

  const onChange = (k: string, v: string) => {
    setData((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    const result = makeSchema(d).safeParse(data);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((er) => { errs[er.path[0] as string] = er.message; });
      setErrors(errs);
      return;
    }
    setPhase("submitting");
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          name: data.name,
          email: data.email,
          company: data.company,
          phone: "",
          role: data.role,
          companySize: data.companySize,
          message: data.message,
        },
      });
      if (error) throw error;
      setFirstName(data.name.split(" ")[0]);
      setPhase("success");
    } catch (err: any) {
      logger.error("Falha ao enviar solicitação de demo", { error: err?.message, module: "Landing" });
      toast.error(d("errEnvio"));
      setPhase("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="lp-demo-dialog sm:max-w-[640px] sm:max-h-[92dvh]">
        <DialogTitle className="sr-only">{d("titulo")}</DialogTitle>
        <DialogDescription className="sr-only">{d("descricao")}</DialogDescription>

        <div className="lp-demo-head">
          <span className="lp-eyebrow">{d("eyebrow")}</span>
          <h2 className="lp-demo-title">
            {d("tituloModal")} <em>{d("tituloModalEm")}</em>
          </h2>
          <p className="lp-demo-sub">{d("sub")}</p>
        </div>

        {phase !== "success" ? (
          <form onSubmit={submit} className="lp-demo-form" autoComplete="off" noValidate>
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden
              value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: "absolute", left: "-9999px", opacity: 0 }}
            />

            <div className="lp-demo-row">
              <Field label={d("nome")} id="d-name" error={errors.name}>
                <input id="d-name" className="lp-modal-input" placeholder={d("nomePlaceholder")}
                  value={data.name} onChange={(e) => onChange("name", e.target.value)} />
              </Field>
              <Field label={d("cargo")} id="d-role" error={errors.role}>
                <input id="d-role" className="lp-modal-input" placeholder={d("cargoPlaceholder")}
                  value={data.role} onChange={(e) => onChange("role", e.target.value)} />
              </Field>
            </div>

            <Field label={d("emailCorporativo")} id="d-email" error={errors.email}>
              <input id="d-email" type="email" className="lp-modal-input" placeholder={d("emailPlaceholder")}
                value={data.email} onChange={(e) => onChange("email", e.target.value)} />
            </Field>

            <div className="lp-demo-row">
              <Field label={d("empresa")} id="d-company" error={errors.company}>
                <input id="d-company" className="lp-modal-input" placeholder={d("razaoSocial")}
                  value={data.company} onChange={(e) => onChange("company", e.target.value)} />
              </Field>
              <Field label={d("tamanho")} id="d-size" error={errors.companySize}>
                <select id="d-size" className="lp-modal-input lp-modal-select"
                  value={data.companySize} onChange={(e) => onChange("companySize", e.target.value)}>
                  {sizes.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
            </div>

            <Field label={d("desafio")} id="d-msg">
              <textarea id="d-msg" rows={3} className="lp-modal-input lp-modal-textarea"
                placeholder={d("desafioPlaceholder")}
                value={data.message} onChange={(e) => onChange("message", e.target.value)} />
            </Field>

            <button type="submit" className="lp-btn-pill lp-btn-pill-block" disabled={phase === "submitting"}>
              {phase === "submitting"
                ? (<><AkurisPulse size={18} /> {d("enviando")}</>)
                : (<>{d("enviar")} <span className="arr">→</span></>)}
            </button>

            <p className="lp-demo-fineprint">
              {d("fineprintPre")}{" "}
              <a href="/politica-privacidade" target="_blank" rel="noreferrer">{d("fineprintLink")}</a>
              {d("fineprintPos")}
            </p>
          </form>
        ) : (
          <div className="lp-demo-success">
            <div className="lp-demo-check"><IconCheck size={28} strokeWidth={2.2} /></div>
            <span className="lp-eyebrow lp-demo-eyebrow-center">{d("recebido")}</span>
            <h3 className="lp-demo-thanks">{d("obrigado")} <em>{firstName}.</em></h3>
            <p className="lp-demo-sub">{d("successSub")}</p>

            <div className="lp-demo-steps">
              {([
                ["01", d("st1Title"), d("st1Desc")],
                ["02", d("st2Title"), d("st2Desc")],
                ["03", d("st3Title"), d("st3Desc")],
              ] as [string, string, string][]).map(([n, title, desc]) => (
                <div key={n} className="lp-step-card">
                  <span className="lp-step-card-num">{n}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="lp-modal-field">
      <label htmlFor={id} className="lp-modal-label">{label}</label>
      {children}
      {error && <span className="lp-modal-error">{error}</span>}
    </div>
  );
}
