/** OAuth returns only to an Akuris origin that started it (preview or site); else the default app. */
export function safeReturnOrigin(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.origin !== raw.replace(/\/$/, "")) return null;
  const host = u.hostname;
  const ok = (u.protocol === "https:" && (
      ["akuris.pt", "akuris.com.br", "www.akuris.com.br", "www.akuris.pt", "akuris-grc.lovable.app"].includes(host) ||
      /^[a-z0-9-]+--e64d00f7-1631-421a-bcc8-86aa27d8fb2a\.lovable\.app$/.test(host) ||
      host === "e64d00f7-1631-421a-bcc8-86aa27d8fb2a.lovableproject.com")) ||
    (u.protocol === "http:" && host === "localhost");
  return ok ? u.origin : null;
}
