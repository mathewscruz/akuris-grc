/** Splits catalogue guidance (PT/EN markdown) into its known sections. */
export interface OrientacaoEstruturada {
  entenda: string;
  passos: string[];
  /** Remaining sections (completion criteria, owners, risks…) in original order. */
  extras: { titulo: string; corpo: string }[];
  estruturada: boolean;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const limpa = (s: string) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim();

export function parseOrientacao(md: string | null | undefined): OrientacaoEstruturada {
  const vazio: OrientacaoEstruturada = { entenda: '', passos: [], extras: [], estruturada: false };
  if (!md?.trim()) return vazio;
  const partes = md.split(/^#{1,3}\s+/m).slice(1);
  if (!partes.length) return vazio;
  const out: OrientacaoEstruturada = { ...vazio, extras: [] };
  for (const p of partes) {
    const [linha, ...resto] = p.split('\n');
    const titulo = linha.replace(/[*_]/g, '').trim();
    const corpo = resto.join('\n').trim();
    const t = norm(titulo);
    if (/^(entenda|understand)/.test(t)) out.entenda = corpo;
    else if (/^(faca nesta ordem|do this in order)/.test(t)) {
      out.passos = corpo.split('\n').filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l)).map(limpa).filter(Boolean);
    } else if (corpo) out.extras.push({ titulo, corpo });
  }
  out.estruturada = out.passos.length > 0;
  return out;
}
