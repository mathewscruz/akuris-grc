/**
 * Vocabulário canónico de severidade, do lado das edge functions.
 *
 * A migration `20260821110000_escala_de_severidade_unica.sql` normalizou
 * `criticidade` e `gravidade` para o masculino em toda a base. Estas funções
 * comparavam com o feminino — `gravidade === 'critica'`, `=== 'alta'` — e
 * passariam a falhar em silêncio: a contagem de denúncias graves ficaria em
 * zero, o webhook nunca marcaria prioridade alta, e o e-mail de notificação
 * sairia com a cor de aviso para um caso crítico.
 *
 * Normalizar à entrada, em vez de trocar as constantes, também protege o que
 * chega de fora: um webhook externo pode mandar "Alta", "CRÍTICA" ou "high".
 */
export type Severidade = 'baixo' | 'medio' | 'alto' | 'critico';

const MAPA: Record<string, Severidade> = {
  critico: 'critico', critica: 'critico', extremo: 'critico', extrema: 'critico',
  muito_alto: 'critico', muito_alta: 'critico', critical: 'critico',
  alto: 'alto', alta: 'alto', elevado: 'alto', elevada: 'alto', high: 'alto',
  medio: 'medio', media: 'medio', moderado: 'medio', moderada: 'medio', medium: 'medio',
  baixo: 'baixo', baixa: 'baixo', muito_baixo: 'baixo', muito_baixa: 'baixo',
  insignificante: 'baixo', low: 'baixo',
};

export function severidadeCanonica(valor?: string | null): Severidade | null {
  if (!valor) return null;
  const chave = valor
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return MAPA[chave] ?? null;
}

/** `true` para 'alto' e 'critico' — o par que exige atenção imediata. */
export function isSevero(valor?: string | null): boolean {
  const s = severidadeCanonica(valor);
  return s === 'alto' || s === 'critico';
}
