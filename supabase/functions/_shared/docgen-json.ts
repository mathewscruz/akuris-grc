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

  const repaired = tryRepair(candidate);
  if (repaired !== null) return repaired;

  // O corte pode ter caído no meio de uma CHAVE (ex.: `{"nome":"B","conte`),
  // onde fechar aspas/brackets ainda produz JSON inválido. Nesse caso
  // recuamos até o último elemento completo e tentamos de novo.
  const boundaries = closingBoundaries(candidate);
  for (let k = boundaries.length - 1; k >= 0 && k >= boundaries.length - 200; k--) {
    const prefix = candidate.slice(0, boundaries[k] + 1);
    const parsed = tryRepair(prefix);
    if (parsed !== null) return parsed;
  }
  return null;
}

/** Fecha string/brackets pendentes e tenta parsear. Devolve null se não der. */
function tryRepair(candidate: string): any | null {
  const { inString, stack } = scan(candidate);
  let repaired = candidate;
  if (inString) repaired += '"';
  // remove separador ou par chave/valor pela metade no fim
  repaired = repaired.replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:?\s*$/, '').replace(/,\s*$/, '');
  for (let i = stack.length - 1; i >= 0; i--) repaired += stack[i];
  try {
    return JSON.parse(repaired);
  } catch (_e) {
    return null;
  }
}

/** Posições dos `}` e `]` fora de string — candidatos a corte seguro. */
function closingBoundaries(candidate: string): number[] {
  const out: number[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '}' || ch === ']') out.push(i);
  }
  return out;
}

function scan(candidate: string): { inString: boolean; stack: string[] } {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  return { inString, stack };
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
