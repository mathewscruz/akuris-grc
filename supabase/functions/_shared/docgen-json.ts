/**
 * DocGen — parsing tolerante do JSON devolvido pelo modelo.
 *
 * Fica em `_shared` para ser testável sem importar o `index.ts` (que sobe o
 * servidor HTTP no import).
 */
/**
 * Extrai o objeto JSON do documento mesmo quando o modelo devolve cercas de
 * código, texto antes/depois ou a resposta é truncada no meio (limite de
 * tokens). Sem isso, um único caractere sobrando derrubava o documento inteiro
 * para um bloco de texto cru sem capa/seções.
 */
export function parseDocumentJson(raw: string): any | null {
  const text = String(raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!text) return null;

  const start = text.indexOf('{');
  if (start === -1) return null;
  const candidate = text.slice(start);

  try {
    return JSON.parse(candidate);
  } catch (_e) { /* segue para o reparo */ }

  // Reparo de truncamento: fecha string aberta e os brackets pendentes.
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let lastSafe = -1;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') { stack.pop(); if (!stack.length) lastSafe = i; }
  }

  let repaired = candidate;
  if (inString) repaired += '"';
  // remove vírgula/valor pela metade no fim
  repaired = repaired.replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) repaired += stack[i];

  try {
    return JSON.parse(repaired);
  } catch (_e) { /* tenta o último objeto completo */ }

  if (lastSafe > 0) {
    try {
      return JSON.parse(candidate.slice(0, lastSafe + 1));
    } catch (_e) { /* desiste */ }
  }
  return null;
}

/** Esquema mínimo aceitável para não publicar um documento capenga. */
export function isValidDocument(doc: any): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (!Array.isArray(doc.secoes)) return false;
  const validSections = doc.secoes.filter(
    (s: any) => s && typeof s.nome === 'string' && s.nome.trim() && String(s.conteudo || '').trim().length >= 80,
  );
  return validSections.length >= 3;
}
