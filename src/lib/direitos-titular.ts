/**
 * Tipos de solicitação do titular — o direito que ele está a exercer.
 *
 * A lista vivia escrita à mão em três sítios (diálogo, filtro e lista), com
 * seis entradas fixas, enquanto `DIREITOS_TITULAR` em `jurisdicao.ts` já
 * enumera os direitos de cada lei: oito na LGPD (Art. 18), sete no RGPD
 * (Arts. 15–22). Faltavam a confirmação de tratamento, a anonimização e a
 * informação sobre partilha — e sobrava a oposição, que é figura do RGPD e
 * não da LGPD.
 */
import { DIREITOS_TITULAR, type JurisdicaoCodigo } from '@/lib/jurisdicao';

/**
 * Valores que já estão gravados e que a lista da jurisdição não usa.
 *
 * Não há migração de dados aqui de propósito: o registo antigo continua a ler
 * bem, e passa ao vocabulário novo na primeira vez que for gravado. Reescrever
 * histórico de pedidos de titular para arrumar um enum seria o pior negócio
 * possível num módulo cuja função é provar o que foi pedido e quando.
 */
const ALIAS: Record<string, string> = {
  exclusao: 'eliminacao',
  revogacao_consentimento: 'revogacao',
  apagamento: 'eliminacao',
  retificacao: 'correcao',
};

/** Chave canónica de um tipo gravado, resolvendo os nomes antigos. */
export const normalizarTipoSolicitacao = (valor?: string | null): string =>
  valor ? (ALIAS[valor] ?? valor) : '';

/** Direitos que a lei aplicável reconhece, para oferecer num seletor. */
export function tiposSolicitacaoDaJurisdicao(
  codigo: JurisdicaoCodigo,
  t: (chave: string) => string,
): { key: string; label: string }[] {
  return DIREITOS_TITULAR[codigo].map((k) => ({ key: k, label: t(`jurisdicao.direitos.${k}`) }));
}

/**
 * Rótulo de um tipo gravado. Um valor que a jurisdição atual não reconhece —
 * porque é antigo ou porque a empresa mudou de jurisdição — continua visível
 * pelo nome que tiver, em vez de desaparecer da lista.
 */
export function rotuloTipoSolicitacao(
  valor: string | null | undefined,
  codigo: JurisdicaoCodigo,
  t: (chave: string) => string,
): string {
  const canonico = normalizarTipoSolicitacao(valor);
  if (!canonico) return '-';
  const conhecido = DIREITOS_TITULAR[codigo].includes(canonico);
  const rotulo = t(`jurisdicao.direitos.${canonico}`);
  return conhecido || rotulo ? rotulo : canonico;
}
