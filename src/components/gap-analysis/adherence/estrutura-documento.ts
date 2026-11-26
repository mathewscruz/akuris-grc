/**
 * Transforma o texto extraído de uma política em blocos estruturados para o
 * leitor do Akuris. Puro e determinístico: o texto nunca é alterado, só
 * classificado (título, lista, definição, parágrafo).
 */
export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2; texto: string; id: string }
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'definicao'; termo: string; texto: string };

const MARCADOR = /^\s*(?:[-•*–·]|\(?[a-z]\)|\d+\))\s+/i;
const NUMERADO = /^(\d+(?:\.\d+)*)\.?\s+(.{2,120})$/;
const REFERENCIA = /^(lei|decreto|portaria|resolução|resolucao|po|iso\/iec|iso|lgpd|gdpr|rgpd|nbr|abnt)\b/i;

function ehMaiusculas(l: string): boolean {
  const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letras.length >= 3 && l.length <= 90 && letras === letras.toUpperCase() && !/[.;,]$/.test(l);
}

const slug = (s: string, i: number) =>
  `sec-${i}-${s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

/** "OBJETIVO" → "Objetivo"; mantém siglas curtas (LGPD, TI). */
export function capitalizar(s: string): string {
  return s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase())
    .replace(/\b(Ti|Lgpd|Iso|Iec|Rgpd|Gdpr|Mec|Clt|Pj|Ava)\b/g, (m) => m.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E|Para|Com|Em|A|O|Of|And|The)\b/g, (m, _x, off) => (off === 0 ? m : m.toLowerCase()));
}

export function estruturarDocumento(texto: string): Bloco[] {
  const linhas = (texto ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const blocos: Bloco[] = [];
  let lista: string[] | null = null;
  let n = 0;
  const fecharLista = () => { if (lista?.length) blocos.push({ tipo: 'lista', itens: lista }); lista = null; };

  for (const l of linhas) {
    if (!l) { fecharLista(); continue; }
    if (ehMaiusculas(l)) {
      fecharLista();
      blocos.push({ tipo: 'titulo', nivel: 1, texto: capitalizar(l), id: slug(l, n++) });
      continue;
    }
    const num = l.match(NUMERADO);
    if (num && num[2].length <= 90 && !/[.;:]$/.test(num[2])) {
      fecharLista();
      const nivel = num[1].includes('.') ? 2 : 1;
      blocos.push({ tipo: 'titulo', nivel, texto: `${num[1]} ${num[2]}`, id: slug(l, n++) });
      continue;
    }
    if (MARCADOR.test(l) || REFERENCIA.test(l)) {
      (lista ??= []).push(l.replace(MARCADOR, ''));
      continue;
    }
    fecharLista();
    const def = l.match(/^([^:]{3,60}):\s+(.{10,})$/);
    if (def && !/[.;]/.test(def[1])) { blocos.push({ tipo: 'definicao', termo: def[1], texto: def[2] }); continue; }
    blocos.push({ tipo: 'paragrafo', texto: l });
  }
  fecharLista();
  return blocos;
}

export function sumarioDe(blocos: Bloco[]) {
  return blocos.filter((b): b is Extract<Bloco, { tipo: 'titulo' }> => b.tipo === 'titulo');
}

export function contarPalavras(texto: string): number {
  return (texto.match(/\S+/g) ?? []).length;
}
