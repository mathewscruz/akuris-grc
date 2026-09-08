import sanitizeHtml from "npm:sanitize-html@2.17.0";
import { brandedEmailDocument, EMAIL_BRAND, type EmailDocumentOptions } from "./email-brand.ts";
export { escapeHtml, emailAction, emailDetails, notificationEmail } from "./email-brand.ts";

export const APP_URL = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://akuris.pt";
export const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Akuris <noreply@akuris.com.br>";
export const EMAIL_LOGO_URL = EMAIL_BRAND.logoUrl;

/** Allowlist adequada para conteúdo editorial criado no editor de campanhas. */
export function sanitizeEmailHtml(value: unknown): string {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "a", "blockquote", "hr"],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["https", "mailto"],
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}

/** Remove scripts, handlers e URLs perigosas sem destruir tabelas/estilos de e-mails legados. */
export function sanitizeEmailDocument(value: unknown): string {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "html", "head", "body", "style", "meta", "title", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "img"],
    allowedAttributes: {
      "*": ["style", "class", "id", "width", "height", "align", "role", "cellpadding", "cellspacing", "alt", "title", "bgcolor", "valign", "lang", "aria-hidden"],
      a: ["href", "target", "rel", "style", "class"],
      meta: ["charset", "name", "content"],
      img: ["src", "alt", "width", "height", "style"],
    },
    allowedSchemes: ["https", "mailto"],
  });
}

export function htmlToText(value: unknown): string {
  return String(value ?? "")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>\s*<td[^>]*>/gi, " — ")
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&rarr;/g, "→")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

export function emailDocument(title: string, body: string, options: EmailDocumentOptions = {}): string {
  return brandedEmailDocument(title, body, { appUrl: APP_URL, ...options });
}
