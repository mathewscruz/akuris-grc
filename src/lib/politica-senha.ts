/**
 * Política de senha do produto — uma só definição.
 *
 * Havia três, e cada caminho aplicava a sua:
 *
 *   · redefinição por link (`DefinirSenha`)  — 8 caracteres, maiúscula,
 *     minúscula e número;
 *   · troca obrigatória de senha temporária   — 6 caracteres, sem classes;
 *   · registo público (`provision-new-account`) — nenhuma, no servidor: o que
 *     o cliente enviasse virava senha.
 *
 * E nenhuma delas valia de facto, porque todas são do lado do cliente: um POST
 * direto ao GoTrue passa por cima. O piso real era o do próprio GoTrue,
 * `GOTRUE_PASSWORD_MIN_LENGTH=6` com `PASSWORD_REQUIRED_CHARACTERS` vazio.
 *
 * Num produto que audita a conformidade dos outros — ISO 27001 A.5.17, e o
 * artigo 46 da LGPD — ter uma política declarada que o sistema não aplica é
 * problema de credibilidade, não só de código. A regra passa a estar aqui, e
 * a ser imposta também no servidor (`supabase/config.toml`, secção `[auth]`).
 */
import { z } from 'zod';

export const SENHA_MIN = 8;

/** As classes exigidas, na mesma ordem em que aparecem na lista de requisitos. */
export const REGRAS_SENHA = [
  { chave: 'minChars', testa: (s: string) => s.length >= SENHA_MIN },
  { chave: 'uppercase', testa: (s: string) => /[A-Z]/.test(s) },
  { chave: 'lowercase', testa: (s: string) => /[a-z]/.test(s) },
  { chave: 'number', testa: (s: string) => /[0-9]/.test(s) },
] as const;

export type ChaveRegraSenha = (typeof REGRAS_SENHA)[number]['chave'];

/** Quais requisitos a senha já cumpre — para a lista com os vistos no ecrã. */
export const avaliarSenha = (senha: string): Record<ChaveRegraSenha, boolean> =>
  Object.fromEntries(REGRAS_SENHA.map((r) => [r.chave, r.testa(senha)])) as Record<
    ChaveRegraSenha,
    boolean
  >;

/** `true` quando a senha cumpre a política inteira. */
export const senhaValida = (senha: string): boolean => REGRAS_SENHA.every((r) => r.testa(senha));

/**
 * Esquema zod da senha. Recebe o tradutor porque as mensagens são as mesmas
 * em todos os ecrãs — antes cada um tinha o seu conjunto de chaves.
 */
export const esquemaSenha = (t: (k: string) => string) =>
  z
    .string()
    .min(SENHA_MIN, t('politicaSenha.minChars'))
    .regex(/[A-Z]/, t('politicaSenha.uppercase'))
    .regex(/[a-z]/, t('politicaSenha.lowercase'))
    .regex(/[0-9]/, t('politicaSenha.number'));

/** Primeira regra por cumprir, ou `null`. Para validar antes de submeter. */
export const primeiraFalha = (senha: string, t: (k: string) => string): string | null => {
  const r = REGRAS_SENHA.find((regra) => !regra.testa(senha));
  return r ? t(`politicaSenha.${r.chave}`) : null;
};
