import sanitizeHtml from "npm:sanitize-html@2.17.0";

export const APP_URL = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://akuris.pt";
export const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Akuris <noreply@akuris.com.br>";
export const EMAIL_LOGO_URL = `${APP_URL}/akuris-logo-email.png`;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allowlist adequada para conteúdo editorial criado no editor de campanhas. */
export function sanitizeEmailHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "a", "blockquote", "hr"],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
    },
  });
}

/** Remove scripts, handlers e URLs perigosas sem destruir tabelas/estilos de e-mails legados. */
export function sanitizeEmailDocument(value: unknown): string {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "html", "head", "body", "style", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "img"],
    allowedAttributes: {
      "*": ["style", "class", "id", "width", "height", "align", "role", "cellpadding", "cellspacing", "alt", "title"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
    },
    allowedSchemes: ["https", "mailto"],
  });
}

export function htmlToText(value: unknown): string {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

export function emailDocument(title: string, body: string, options: { eyebrow?: string; footer?: string } = {}): string {
  const safeTitle = escapeHtml(title);
  const eyebrow = options.eyebrow ? `<p style="margin:0 0 10px;color:#7552ff;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(options.eyebrow)}</p>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6f9;color:#202938;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${safeTitle}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 12px"><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #dfe4eb;border-radius:8px;overflow:hidden"><tr><td style="background:#0a1628;padding:25px 36px;text-align:left"><img src="${EMAIL_LOGO_URL}" width="160" alt="Akuris" style="display:block;width:160px;height:auto"></td></tr><tr><td style="height:2px;background:#7552ff"></td></tr><tr><td style="padding:34px 36px 12px">${eyebrow}<h1 style="margin:0;color:#0a1628;font-size:25px;line-height:1.3">${safeTitle}</h1></td></tr><tr><td style="padding:10px 36px 32px;font-size:15px;line-height:1.7">${body}</td></tr><tr><td style="border-top:1px solid #e7ebf0;padding:20px 36px;color:#687589;font-size:12px;line-height:1.55">${options.footer || `Mensagem enviada pela Akuris. <a href="${APP_URL}" style="color:#5f43db">Acessar a plataforma</a>.`}</td></tr></table></td></tr></table></body></html>`;
}
