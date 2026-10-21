// Regras puras de quando o responsável de uma tarefa de projeto recebe aviso.

export type Lembrete = "3d" | "dia" | null;

export interface TarefaLembrete {
  data_fim: string | null;
  prazo: string | null;
  concluida_em: string | null;
  progresso_pct: number | null;
  responsavel_id: string | null;
  lembrete_3d_enviado_em: string | null;
  lembrete_dia_enviado_em: string | null;
}

/** Data de fim (AAAA-MM-DD) da tarefa. */
export const fimDe = (t: Pick<TarefaLembrete, "data_fim" | "prazo">) =>
  (t.data_fim ?? t.prazo)?.slice(0, 10) ?? null;

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 86400000);

/** Qual lembrete de prazo enviar hoje (no máximo um), ou null. */
export function lembreteDevido(t: TarefaLembrete, hoje: string, ehFolha: boolean, colunaConcluida: boolean): Lembrete {
  if (!ehFolha || !t.responsavel_id || colunaConcluida) return null;
  if (t.concluida_em || (t.progresso_pct ?? 0) >= 100) return null;
  const fim = fimDe(t);
  if (!fim) return null;
  const d = diasEntre(hoje, fim);
  if (d === 0 && !t.lembrete_dia_enviado_em) return "dia";
  if (d >= 1 && d <= 3 && !t.lembrete_3d_enviado_em) return "3d";
  return null;
}

/** Atribuição/status: não avisa quem fez a própria ação. */
export const deveAvisarEvento = (responsavelId: string | null, atorId: string | null) =>
  !!responsavelId && responsavelId !== atorId;

/** Quem fez a ação, para o texto do e-mail. Nulo = automação/sistema. */
export function autoria(perfil: { nome?: string | null; email?: string | null } | null): { nome: string; automacao: boolean } {
  const nome = perfil?.nome?.trim() || perfil?.email?.trim();
  return nome ? { nome, automacao: false } : { nome: "Uma automação do projeto", automacao: true };
}
