// Regras de calendário dos relatórios agendados (dia em Brasília).
export type Frequencia = "semanal" | "mensal" | "trimestral";

/** Dia da semana ISO: 1 = segunda … 7 = domingo. */
export const diaSemanaIso = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

export function devidoHoje(freq: string, diaEnvio: number | null, hoje: Date, ultimoEnvio: string | null): boolean {
  const hojeIso = hoje.toISOString().slice(0, 10);
  if (ultimoEnvio && ultimoEnvio.slice(0, 10) === hojeIso) return false;
  const dia = diaEnvio || 1;
  if (freq === "semanal") return diaSemanaIso(hoje) === Math.min(7, Math.max(1, dia));
  const diaMes = Math.min(28, Math.max(1, dia));
  if (freq === "mensal") return hoje.getUTCDate() === diaMes;
  if (freq === "trimestral") return [0, 3, 6, 9].includes(hoje.getUTCMonth()) && hoje.getUTCDate() === diaMes;
  return false;
}

/** Próxima data (YYYY-MM-DD) estritamente depois de `hoje`. */
export function proximoEnvio(freq: string, diaEnvio: number | null, hoje: Date): string | null {
  if (!["semanal", "mensal", "trimestral"].includes(freq)) return null;
  for (let i = 1; i <= 400; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + i));
    if (devidoHoje(freq, diaEnvio, d, null)) return d.toISOString().slice(0, 10);
  }
  return null;
}
