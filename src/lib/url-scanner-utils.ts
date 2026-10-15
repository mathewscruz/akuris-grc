/** Utilitários puros do Scanner de Formulários Web. */

const PESO: Record<string, number> = { critico: 0, sensivel: 1 };

/** Ordena campos: críticos → sensíveis → comuns, preservando a ordem original dentro de cada grupo. */
export function ordenarPorSensibilidade<T extends { sensitivity: string }>(campos: T[]): Array<{ campo: T; indice: number }> {
  return campos
    .map((campo, indice) => ({ campo, indice }))
    .sort((a, b) => (PESO[a.campo.sensitivity] ?? 2) - (PESO[b.campo.sensitivity] ?? 2) || a.indice - b.indice);
}

/** Normaliza a URL digitada (adiciona https://) e retorna null quando inválida. */
export function normalizarUrlScan(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  const comProtocolo = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  try {
    const u = new URL(comProtocolo);
    if (!u.hostname.includes('.') || /\s/.test(bruto)) return null;
    return u.toString().replace(/\/$/, u.pathname === '/' && !bruto.endsWith('/') ? '' : '/');
  } catch {
    return null;
  }
}

/** Nome amigável do formulário — evita exibir atributos técnicos genéricos como "name". */
export function nomeAmigavelFormulario(nome: string | undefined, indice: number, rotulo: string): string {
  const n = (nome ?? '').trim();
  if (!n || ['name', 'form', 'formulario', 'undefined', 'null'].includes(n.toLowerCase())) {
    return `${rotulo} ${indice + 1}`;
  }
  return n;
}
