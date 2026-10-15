/** Regras puras dos alertas dos painéis de detalhe. */
export const JANELA_VENCIMENTO_DIAS = 60;

export function diasAte(data: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!data) return null;
  const alvo = new Date(data.length <= 10 ? data + 'T00:00:00' : data);
  if (Number.isNaN(alvo.getTime())) return null;
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fim = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
  return Math.round((fim.getTime() - base.getTime()) / 86_400_000);
}

export type EstadoVencimento = 'vencido' | 'aVencer' | null;

/** Vencido se a data já passou; "a vencer" se faltam até `janela` dias (inclusive). */
export function estadoVencimento(
  data: string | null | undefined,
  hoje: Date = new Date(),
  janela = JANELA_VENCIMENTO_DIAS,
): EstadoVencimento {
  const d = diasAte(data, hoje);
  if (d === null) return null;
  if (d < 0) return 'vencido';
  if (d <= janela) return 'aVencer';
  return null;
}

/** Dias decorridos desde uma data (tempo em aberto). */
export function diasDesde(data: string | null | undefined, hoje: Date = new Date()): number | null {
  const d = diasAte(data, hoje);
  return d === null ? null : Math.max(0, -d);
}
