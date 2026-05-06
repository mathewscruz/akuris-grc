import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AkurisPulse } from "@/components/ui/AkurisPulse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { z } from "zod";
import { logger } from "@/lib/logger";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(200),
  company: z.string().trim().min(2, "Informe a empresa").max(160),
  companySize: z.string().min(1, "Selecione o tamanho"),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

const sizes = [
  { v: "", l: "Selecione" },
  { v: "1-50", l: "Até 50 colaboradores" },
  { v: "51-250", l: "51–250" },
  { v: "251-1000", l: "251–1.000" },
  { v: "1000+", l: "Mais de 1.000" },
];

export function DemoRequestDialog({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [data, setData] = useState({ name: "", role: "", email: "", company: "", companySize: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");

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
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    const result = schema.safeParse(data);
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
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
      setPhase("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="lp-demo-dialog sm:max-w-[640px] sm:max-h-[92dvh]">
        <DialogTitle className="sr-only">Solicitar demonstração</DialogTitle>
        <DialogDescription className="sr-only">Formulário de solicitação de demo personalizada.</DialogDescription>

        <div className="lp-demo-head">
          <span className="lp-eyebrow">Demonstração · 30 minutos</span>
          <h2 className="lp-demo-title">
            Conheça o Akuris <em>com seu próprio cenário.</em>
          </h2>
          <p className="lp-demo-sub">
            Um especialista entra em contato em até 1 dia útil com uma agenda. Sem script genérico, sem ligar pra vender seguro de carro depois.
          </p>
        </div>

        {phase !== "success" ? (
          <form onSubmit={submit} className="lp-demo-form" autoComplete="off" noValidate>
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden
              value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: "absolute", left: "-9999px", opacity: 0 }}
            />

            <div className="lp-demo-row">
              <Field label="Nome" id="d-name" error={errors.name}>
                <input id="d-name" className="lp-modal-input" placeholder="Seu nome"
                  value={data.name} onChange={(e) => onChange("name", e.target.value)} />
              </Field>
              <Field label="Cargo" id="d-role" error={errors.role}>
                <input id="d-role" className="lp-modal-input" placeholder="DPO, Compliance Officer…"
                  value={data.role} onChange={(e) => onChange("role", e.target.value)} />
              </Field>
            </div>

            <Field label="E-mail corporativo" id="d-email" error={errors.email}>
              <input id="d-email" type="email" className="lp-modal-input" placeholder="voce@empresa.com.br"
                value={data.email} onChange={(e) => onChange("email", e.target.value)} />
            </Field>

            <div className="lp-demo-row">
              <Field label="Empresa" id="d-company" error={errors.company}>
                <input id="d-company" className="lp-modal-input" placeholder="Razão social"
                  value={data.company} onChange={(e) => onChange("company", e.target.value)} />
              </Field>
              <Field label="Tamanho" id="d-size" error={errors.companySize}>
                <select id="d-size" className="lp-modal-input lp-modal-select"
                  value={data.companySize} onChange={(e) => onChange("companySize", e.target.value)}>
                  {sizes.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
            </div>

            <Field label="O que você quer resolver? (opcional)" id="d-msg">
              <textarea id="d-msg" rows={3} className="lp-modal-input lp-modal-textarea"
                placeholder="Ex: próxima auditoria SOC 2 em 4 meses…"
                value={data.message} onChange={(e) => onChange("message", e.target.value)} />
            </Field>

            <button type="submit" className="lp-btn-pill lp-btn-pill-block" disabled={phase === "submitting"}>
              {phase === "submitting" ? (<><AkurisPulse size={18} /> Enviando</>) : (<>Solicitar demonstração <span className="arr">→</span></>)}
            </button>

            <p className="lp-demo-fineprint">
              Ao enviar, você concorda com nossa <a href="/politica-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>. Tratamos seus dados sob a LGPD, claro.
            </p>
          </form>
        ) : (
          <div className="lp-demo-success">
            <div className="lp-demo-check"><Check size={28} strokeWidth={2.2} /></div>
            <span className="lp-eyebrow lp-demo-eyebrow-center">Recebido</span>
            <h3 className="lp-demo-thanks">Obrigado, <em>{firstName}.</em></h3>
            <p className="lp-demo-sub">
              Sua solicitação chegou ao nosso time. Em até 1 dia útil você recebe um e-mail com agenda e contexto.
            </p>

            <div className="lp-demo-steps">
              {[
                ["01", "Confirmação no seu e-mail", "Verifique a caixa de entrada (e o spam, na dúvida) nos próximos minutos."],
                ["02", "Conversa de 15 minutos", "Entendemos seu cenário antes da demo, para mostrar só o que importa pra você."],
                ["03", "Demo guiada de 30 minutos", "Com seus frameworks e taxonomia, não um tour genérico de plataforma."],
              ].map(([n, t, d]) => (
                <div key={n} className="lp-step-card">
                  <span className="lp-step-card-num">{n}</span>
                  <div>
                    <strong>{t}</strong>
                    <p>{d}</p>
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
