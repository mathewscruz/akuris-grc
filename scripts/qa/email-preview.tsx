/** Local-only preview of actual outgoing templates. Does not send mail or read credentials.
 * npx deno run --config scripts/qa/email-deno.json --allow-env=APP_URL,SITE_URL,EMAIL_FROM,NODE_ENV --allow-read=public/akuris-logo-email-dark-v2.png --allow-net=127.0.0.1:8082 scripts/qa/email-preview.tsx
 */
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import {
  operationalEmail,
  type OperationalEmailKind,
} from "../../supabase/functions/_shared/operational-email.ts";
import { EMAIL_BRAND } from "../../supabase/functions/_shared/email-brand.ts";
import { sanitizeEmailDocument } from "../../supabase/functions/_shared/email.ts";
import { MFACodeEmail } from "../../supabase/functions/send-mfa-code/_templates/mfa-code-email.tsx";
import { PasswordResetEmail } from "../../supabase/functions/send-password-reset/_templates/password-reset-email.tsx";
import { WelcomeEmail } from "../../supabase/functions/send-welcome-email/_templates/welcome-email.tsx";
import { InvitationReminderEmail } from "../../supabase/functions/process-invitation-reminders/_templates/invitation-reminder-email.tsx";
import { BaseEmailTemplate } from "../../supabase/functions/_shared/email-templates/BaseEmailTemplate.tsx";

const demos: Partial<
  Record<OperationalEmailKind, Record<string, string | number>>
> = {
  audit: {
    name: "Marina Costa",
    item: "Revisão dos parâmetros de autenticação",
    code: "CTRL-0042",
    audit: "Auditoria interna 2026",
    deadline: "15/09/2026",
    url: "https://akuris.pt/governanca/auditorias?focus=exemplo",
  },
  contract: {
    item: "Serviços de infraestrutura",
    code: "CT-0028",
    status: "Vence em 7 dias",
    deadline: "15/09/2026",
    supplier: "Fornecedor de exemplo",
    amount: "R$ 24.000,00",
    owner: "Marina Costa",
    tone: "warning",
    url: "https://akuris.pt/contratos?contrato=exemplo",
  },
  incident: {
    item: "Indisponibilidade de aplicação",
    type: "Operacional",
    severity: "Alta",
    owner: "Marina Costa",
    tone: "danger",
    url: "https://akuris.pt/incidentes?incidente=exemplo",
  },
  dueDiligence: {
    name: "Equipe do fornecedor",
    item: "Avaliação de segurança e privacidade",
    company: "Empresa de exemplo",
    deadline: "30/09/2026",
    url: "https://akuris.pt/assessment/exemplo",
    status: "invitation",
  },
};
const menu = {
  audit: "Auditoria",
  contract: "Vencimento",
  incident: "Incidente",
  dueDiligence: "Due diligence",
  mfa: "MFA",
  password: "Recuperação",
  welcome: "Convite",
  reminder: "Lembrete",
  campaign: "Comunicado",
};

Deno.serve({ hostname: "127.0.0.1", port: 8082 }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/logo.png") {
    return new Response(
      await Deno.readFile(
        new URL("../../public/akuris-logo-email-dark-v2.png", import.meta.url),
      ),
      { headers: { "Content-Type": "image/png" } },
    );
  }
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; frame-src 'self'; script-src 'none'",
  };
  if (url.pathname === "/") {
    return new Response(
      `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Akuris — Modelos de e-mail</title><style>body{margin:0;background:#f3f4f7;font:14px Arial;color:#242731}header{background:#fff;padding:18px 24px;border-bottom:1px solid #e3e5ec}h1{font-size:17px;margin:0 0 8px}p{color:#596273;margin:0 0 16px}nav{display:flex;flex-wrap:wrap;gap:8px}a{padding:8px 12px;background:#f5f2ff;border-radius:6px;color:#5434cf;text-decoration:none}iframe{width:100%;height:calc(100vh - 140px);border:0}</style></head><body><header><h1>Akuris · E-mails da ferramenta</h1><p>Prévia local dos modelos reais. Dados fictícios; nenhum e-mail é enviado.</p><nav>${
        Object.entries(menu).map(([key, label]) =>
          `<a href="/${key}" target="message">${label}</a>`
        ).join("")
      }</nav></header><iframe name="message" title="Modelo de e-mail" src="/audit"></iframe></body></html>`,
      { headers },
    );
  }
  const key = url.pathname.slice(1);
  let html: string;
  if (demos[key as OperationalEmailKind]) {
    html = sanitizeEmailDocument(
      operationalEmail(
        key as OperationalEmailKind,
        demos[key as OperationalEmailKind]!,
      ),
    );
  } else if (key === "mfa") {
    html = await renderAsync(<MFACodeEmail userName="Marina" code="123456" />);
  } else if (key === "password") {
    html = await renderAsync(
      <PasswordResetEmail
        userName="Marina"
        resetUrl="https://akuris.pt/definir-senha?token=exemplo-sem-validade"
      />,
    );
  } else if (key === "welcome") {
    html = await renderAsync(
      <WelcomeEmail
        userName="Marina"
        userEmail="marina@example.test"
        setupPasswordUrl="https://akuris.pt/definir-senha?token=exemplo-sem-validade"
      />,
    );
  } else if (key === "reminder") {
    html = await renderAsync(
      <InvitationReminderEmail
        userName="Marina"
        userEmail="marina@example.test"
        companyName="Empresa de exemplo"
        loginUrl="https://akuris.pt/auth"
        reminderNumber={1}
        maxReminders={3}
      />,
    );
  } else if (key === "campaign") {
    html = await renderAsync(
      <BaseEmailTemplate
        title="Sua equipe, mais próxima das evidências"
        previewText="Organize as evidências da sua próxima auditoria."
        footerNote={<a href="https://akuris.pt">Gerenciar comunicados</a>}
      >
        <p>Olá, Marina.</p>
        <p>
          Reúna os documentos, acompanhe as pendências e mantenha a equipe
          alinhada para a próxima avaliação.
        </p>
      </BaseEmailTemplate>,
    );
  } else return new Response("Not found", { status: 404 });
  return new Response(html.replaceAll(EMAIL_BRAND.logoUrl, "/logo.png"), {
    headers,
  });
});
