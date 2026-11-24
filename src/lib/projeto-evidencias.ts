import { tGlobal } from '@/lib/i18n-global';

export const LIMITE_EVIDENCIA_BYTES = 20 * 1024 * 1024;

/** Link de evidência aceito: apenas https. */
export const linkEvidenciaValido = (url: string) => /^https:\/\/\S+$/i.test(url.trim());

/** Erro do banco ao concluir sem evidência → mensagem clara; senão o fallback. */
export function mensagemErroTarefa(err: unknown, fallback: string): string {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return msg.includes('EVIDENCIA_OBRIGATORIA') ? tGlobal('evidSemana.obrigatoria') : (msg || fallback);
}

/** Semanas (segunda a domingo) que cobrem [min, max). */
export function semanasNoIntervalo(min: number, max: number): { ini: number; fim: number; num: number }[] {
  const d = new Date(min); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const out: { ini: number; fim: number; num: number }[] = [];
  while (d.getTime() < max) {
    const ini = d.getTime();
    const prox = new Date(d); prox.setDate(prox.getDate() + 7);
    out.push({ ini, fim: prox.getTime(), num: numeroSemanaNoMes(new Date(ini)) });
    d.setTime(prox.getTime());
  }
  return out;
}

/** Nº da semana dentro do mês da quinta-feira dessa semana (S1..S5). */
export function numeroSemanaNoMes(segunda: Date): number {
  const quinta = new Date(segunda); quinta.setDate(quinta.getDate() + 3);
  return Math.ceil(quinta.getDate() / 7);
}

/** Limites da semana atual (segunda 00:00 a próxima segunda). */
export function semanaAtual(hoje = new Date()): { ini: number; fim: number } {
  const s = semanasNoIntervalo(hoje.getTime(), hoje.getTime() + 1)[0];
  return { ini: s.ini, fim: s.fim };
}
