/**
 * Canal pelo qual o titular fez a solicitação — vocabulário único.
 *
 * O rótulo existia apenas dentro do diálogo de criação, como seis
 * `<SelectItem>` soltos. A tabela de Solicitações não tinha `render` nenhum na
 * coluna Canal, por isso imprimia o valor cru do banco: "telefone", "portal",
 * "email" — em minúsculas, no meio de uma tabela cujas outras colunas mostram
 * "Correção", "Pendente", "E-mail".
 *
 * Valor de domínio nunca vai cru para o ecrã: quem o escolheu foi o sistema,
 * não o utilizador, e por isso escreve-se como o produto escreve.
 */
import { formatStatus } from '@/lib/text-utils';

export const CANAIS_SOLICITACAO = [
  'email',
  'portal',
  'presencial',
  'telefone',
  'chat',
  'outros',
] as const;

export type CanalSolicitacao = (typeof CANAIS_SOLICITACAO)[number];

/** Chave de tradução de cada canal, no espaço onde os rótulos já viviam. */
const CHAVE: Record<CanalSolicitacao, string> = {
  email: 'canalEmail',
  portal: 'canalPortal',
  presencial: 'canalPresencial',
  telefone: 'canalTelefone',
  chat: 'canalChat',
  outros: 'canalOutros',
};

/**
 * Um valor fora do vocabulário continua visível — em title-case — em vez de
 * desaparecer. Num produto de conformidade, esconder um dado estranho é pior
 * do que mostrá-lo estranho.
 */
export function rotuloCanalSolicitacao(
  canal: string | null | undefined,
  t: (chave: string) => string,
): string {
  if (!canal) return '-';
  const chave = CHAVE[canal as CanalSolicitacao];
  return chave ? t(`dadosDashboard.solicitacaoTitularDialog.${chave}`) : formatStatus(canal);
}

/** As opções para um `<Select>`, já traduzidas e na ordem do diálogo. */
export const opcoesCanalSolicitacao = (t: (chave: string) => string) =>
  CANAIS_SOLICITACAO.map((canal) => ({ value: canal, label: rotuloCanalSolicitacao(canal, t) }));
