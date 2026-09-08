/** Email-safe design primitives. No runtime dependencies: shared with the editor preview. */
export const EMAIL_BRAND = {
  logoUrl: "https://akuris.pt/akuris-logo-email-dark-v2.png",
  font: "'DM Sans',Arial,Helvetica,sans-serif",
  primary: "#6542e8",
  ink: "#242731",
  muted: "#596273",
  background: "#f3f4f7",
  border: "#e3e5ec",
};

export type EmailLocale = "pt" | "en";
export const EMAIL_COPY = {
  pt: {
    greeting: "Olá",
    next: "Próximo passo",
    fallback: "Se o botão não abrir, use este link:",
    footer: "Mensagem automática do Akuris. Não responda a este e-mail.",
    platform: "Acessar o Akuris",
    team: "Equipe Akuris",
    signature: "Até breve,",
    empty: "Não informado",
  },
  en: {
    greeting: "Hello",
    next: "Next step",
    fallback: "If the button does not open, use this link:",
    footer: "Automated message from Akuris. Please do not reply to this email.",
    platform: "Open Akuris",
    team: "The Akuris team",
    signature: "See you soon,",
    empty: "Not provided",
  },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function safeEmailUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export const EMAIL_CSS = `
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:separate;mso-table-lspace:0pt;mso-table-rspace:0pt}
img{border:0;outline:none;text-decoration:none}
.email-content p{margin:0 0 18px}.email-content a{color:#6542e8}
.email-content h2{font-size:20px;line-height:1.4}.email-content h3{font-size:17px;line-height:1.4}
.email-content .email-button{color:#ffffff!important;text-decoration:none!important}
@media only screen and (max-width:620px){
 .email-outer{padding:16px 8px!important}.email-pad{padding-left:22px!important;padding-right:22px!important}
 .email-title{font-size:25px!important;line-height:32px!important}.email-card-pad{padding:18px!important}
 .email-button{display:block!important;text-align:center!important}.email-detail-label{width:40%!important}
}
@media (prefers-color-scheme:dark){.email-logo-surface{background:#ffffff!important}}
`;

export const EMAIL_HEADER_HTML =
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="email-pad email-logo-surface" bgcolor="#ffffff" style="padding:28px 36px 22px;background:#ffffff;border-bottom:1px solid ${EMAIL_BRAND.border}"><img src="${EMAIL_BRAND.logoUrl}" width="156" height="47" alt="Akuris" style="display:block;width:156px;height:auto;color:#242731;font-size:24px;font-weight:700;background:#ffffff"></td></tr></table>`;

export type EmailDocumentOptions = {
  eyebrow?: string;
  footer?: string;
  preheader?: string;
  locale?: EmailLocale;
  appUrl?: string;
};

/** body/footer are trusted, already escaped or sanitized HTML; title/preview are plain text. */
export function brandedEmailDocument(
  title: string,
  body: string,
  options: EmailDocumentOptions = {},
): string {
  const locale = options.locale || "pt";
  const copy = EMAIL_COPY[locale];
  const appUrl = escapeHtml(
    safeEmailUrl(options.appUrl || "https://akuris.pt"),
  );
  return `<!doctype html><html lang="${
    locale === "pt" ? "pt-BR" : "en"
  }"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${
    escapeHtml(title)
  } — Akuris</title><style>${EMAIL_CSS}</style></head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.background};color:${EMAIL_BRAND.ink};font-family:${EMAIL_BRAND.font}">
<div aria-hidden="true" style="display:none!important;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${
    escapeHtml(options.preheader || title)
  }</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${EMAIL_BRAND.background}"><tr><td class="email-outer" align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:14px;overflow:hidden">
<tr><td>${EMAIL_HEADER_HTML}</td></tr>
<tr><td class="email-pad" style="padding:30px 36px 16px">${
    options.eyebrow
      ? `<p style="margin:0 0 12px;color:${EMAIL_BRAND.primary};font-size:13px;line-height:18px;font-weight:700">${
        escapeHtml(options.eyebrow)
      }</p>`
      : ""
  }<h1 class="email-title" style="margin:0;font-size:28px;line-height:36px;letter-spacing:-.6px;font-weight:700;color:${EMAIL_BRAND.ink}">${
    escapeHtml(title)
  }</h1></td></tr>
<tr><td class="email-pad email-content" style="padding:4px 36px 32px;font-size:15px;line-height:25px;color:${EMAIL_BRAND.muted};overflow-wrap:anywhere;word-break:break-word">${body}</td></tr>
<tr><td class="email-pad" style="padding:22px 36px;border-top:1px solid ${EMAIL_BRAND.border};color:${EMAIL_BRAND.muted};font-size:12px;line-height:19px">${
    options.footer ||
    `${copy.footer}<br><a href="${appUrl}" style="color:${EMAIL_BRAND.primary};text-decoration:underline">${copy.platform}</a>`
  }</td></tr>
</table>
</td></tr></table></body></html>`;
}

export function emailAction(
  label: string,
  url: string,
  locale: EmailLocale = "pt",
): string {
  const safeUrl = safeEmailUrl(url);
  if (!safeUrl) return "";
  const href = escapeHtml(safeUrl);
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 16px"><tr><td bgcolor="${EMAIL_BRAND.primary}" style="border-radius:8px;background:${EMAIL_BRAND.primary};text-align:center;mso-padding-alt:14px 24px"><a class="email-button" href="${href}" style="display:inline-block;padding:14px 24px;color:#ffffff;background:${EMAIL_BRAND.primary};border-radius:8px;font-size:15px;line-height:22px;font-weight:700;text-decoration:none">${
    escapeHtml(label)
  } &rarr;</a></td></tr></table><p style="margin:0;font-size:12px;line-height:19px;color:${EMAIL_BRAND.muted}">${
    EMAIL_COPY[locale].fallback
  }<br><a href="${href}" style="color:${EMAIL_BRAND.primary};word-break:break-all;text-decoration:underline">${href}</a></p>`;
}

export type EmailTone = "neutral" | "success" | "warning" | "danger";
export function emailDetails(
  title: string,
  fields: ReadonlyArray<readonly [string, unknown]>,
  options: {
    code?: string;
    description?: string;
    tone?: EmailTone;
    locale?: EmailLocale;
  } = {},
): string {
  const accents = {
    neutral: "#6542e8",
    success: "#17764f",
    warning: "#9b570d",
    danger: "#bb303d",
  };
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid ${EMAIL_BRAND.border};border-top:3px solid ${
    accents[options.tone || "neutral"]
  };border-radius:10px;background:#fafafd"><tr><td class="email-card-pad" style="padding:22px">
${
    options.code
      ? `<p style="margin:0 0 6px;font-size:12px;line-height:18px;letter-spacing:.6px;font-weight:700;color:${EMAIL_BRAND.primary}">${
        escapeHtml(options.code)
      }</p>`
      : ""
  }
<h2 style="margin:0 0 14px;color:${EMAIL_BRAND.ink};font-size:19px;line-height:27px;font-weight:700">${
    escapeHtml(title)
  }</h2>
${
    options.description
      ? `<p style="margin:0 0 16px;white-space:pre-wrap">${
        escapeHtml(options.description)
      }</p>`
      : ""
  }
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${
    fields.filter(([, value]) =>
      value !== undefined && value !== null && value !== ""
    ).map(([label, value]) =>
      `<tr><td class="email-detail-label" width="36%" valign="top" style="padding:7px 12px 7px 0;border-top:1px solid ${EMAIL_BRAND.border};font-size:13px;line-height:21px;color:${EMAIL_BRAND.muted}">${
        escapeHtml(label)
      }</td><td valign="top" style="padding:7px 0;border-top:1px solid ${EMAIL_BRAND.border};font-size:14px;line-height:21px;font-weight:600;color:${EMAIL_BRAND.ink};word-break:break-word">${
        escapeHtml(value)
      }</td></tr>`
    ).join("")
  }</table>
</td></tr></table>`;
}

export function notificationEmail(
  options: {
    title: string;
    module: string;
    name?: string;
    intro: string;
    item: string;
    fields?: ReadonlyArray<readonly [string, unknown]>;
    code?: string;
    description?: string;
    next?: string;
    action?: { label: string; url: string };
    tone?: EmailTone;
    footer?: string;
    locale?: EmailLocale;
  },
): string {
  const locale = options.locale || "pt";
  const copy = EMAIL_COPY[locale];
  const body = `${
    options.name
      ? `<p style="margin:0 0 16px">${copy.greeting}, <strong style="color:${EMAIL_BRAND.ink}">${
        escapeHtml(options.name)
      }</strong>.</p>`
      : ""
  }
<p style="margin:0 0 18px">${escapeHtml(options.intro)}</p>
${emailDetails(options.item, options.fields || [], options)}
${
    options.next
      ? `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${EMAIL_BRAND.ink}">${copy.next}</p><p style="margin:0 0 18px">${
        escapeHtml(options.next)
      }</p>`
      : ""
  }
${
    options.action
      ? emailAction(options.action.label, options.action.url, locale)
      : ""
  }`;
  return brandedEmailDocument(options.title, body, {
    eyebrow: options.module,
    preheader: options.intro,
    footer: options.footer,
    locale,
  });
}
