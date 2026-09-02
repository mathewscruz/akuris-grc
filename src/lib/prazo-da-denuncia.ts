/**
 * Qual dos dois prazos legais está a correr, e quando é que ele aperta.
 *
 * A Diretiva (UE) 2019/1937 impõe dois relógios a uma denúncia: acusar o
 * recebimento em 7 dias (art. 9.º/1/b) e dar retorno ao informante em 3 meses
 * (art. 9.º/1/f). Não correm ao mesmo tempo para efeitos de quem trabalha: até
 * o recebimento ser acusado, o que aperta é o primeiro.
 *
 * A regra estava escrita em três sítios e um deles discordava:
 *
 *  · `DenunciaRelogio` — mostra os dois, e fecha o primeiro. Certo.
 *  · `useMinhasPendencias` — escolhe o activo. Certo.
 *  · `DenunciasDashboard` — lia SÓ `prazo_retorno`. Errado, e era a lista.
 *
 * Medido numa denúncia registada a 02/09/2026, com acusação a vencer a 09/09 e
 * retorno a 01/12: a lista dizia «Faltam 90 dias», a coluna ficava cinzenta, e
 * o filtro «vencem em 15 dias» não a mostrava. Quem gere o canal via folga
 * onde havia uma semana — e o sino, esse, avisava ao segundo dia.
 *
 * Está aqui para não voltar a haver três versões da mesma regra.
 */

/** O mínimo que a regra precisa de saber. Cada ecrã traz mais campos. */
export interface PrazosDaDenuncia {
  prazo_acusacao?: string | null;
  prazo_retorno?: string | null;
  data_acusacao_recebimento?: string | null;
  status?: string | null;
}

/** Estados em que já não há prazo a cumprir — o trabalho está feito. */
export const ESTADOS_ENCERRADOS = ['resolvida', 'arquivada'];

export const encerrada = (d: PrazosDaDenuncia): boolean =>
  ESTADOS_ENCERRADOS.includes(String(d.status ?? ''));

/**
 * A partir de quantos dias cada prazo passa a ser «a vencer».
 *
 * Sete dias e noventa não cabem na mesma régua: «faltam 15» é folga larga num
 * e impossível no outro. São os números que `vigiar_prazos_denuncias` usa para
 * tocar o sino — a lista e o aviso não podem discordar sobre o que é urgente.
 */
export const JANELA_DE_ALERTA = { acusacao: 2, retorno: 15 } as const;

export interface PrazoActivo {
  /** A data que conta, ou `null` quando não há prazo gravado. */
  data: string | null;
  /** `true` enquanto o recebimento não foi acusado. */
  acusacao: boolean;
  /** Dias de folga antes de o prazo passar a «a vencer». */
  janela: number;
}

export function prazoActivo(d: PrazosDaDenuncia): PrazoActivo {
  if (!d.data_acusacao_recebimento) {
    return { data: d.prazo_acusacao ?? null, acusacao: true, janela: JANELA_DE_ALERTA.acusacao };
  }
  return { data: d.prazo_retorno ?? null, acusacao: false, janela: JANELA_DE_ALERTA.retorno };
}
