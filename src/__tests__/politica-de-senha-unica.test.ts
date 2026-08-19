/**
 * A política de senha é uma só, e vive em `src/lib/politica-senha.ts`.
 *
 * Havia três, e a conta era a mesma nas três:
 *
 *   · redefinição por link       — 8 caracteres, maiúscula, minúscula, número;
 *   · troca de senha temporária  — 6 caracteres, sem classes nenhumas;
 *   · registo público            — nada no servidor.
 *
 * Um utilizador obrigado a trocar a senha temporária podia pôr `123456`, e a
 * mesma conta, no dia seguinte, seria recusada pelo ecrã de redefinição por
 * ter menos de 8. Num produto que audita a conformidade dos outros, ter uma
 * política declarada que o próprio sistema não aplica é problema de
 * credibilidade, não apenas de código.
 *
 * A imposição a sério é do servidor — `[auth] password_min_length` no
 * `supabase/config.toml` e a verificação em `provision-new-account`. Este teste
 * cuida do outro lado: que nenhum ecrã volte a inventar a sua própria regra.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';
import { REGRAS_SENHA, SENHA_MIN, avaliarSenha, senhaValida } from '@/lib/politica-senha';

/**
 * Regra de comprimento aplicada a algo cujo nome fala de senha.
 *
 * O limite tem de ser >= 2 dígitos ou um dígito >= 4: `length > 0` é "o campo
 * está preenchido", não uma política, e aparece em toda a parte legítima.
 */
const COMPRIMENTO_PROPRIO =
  /(?:password|senha|Password|Senha)\w*\s*(?:\.length\s*[<>]=?\s*(?:[4-9]|\d\d)|\)\s*\.min\(\s*\d+)/;

/**
 * O medidor de força pontua por comprimento, e isso é legítimo: mede, não
 * impõe. Distingue-se por atribuir a uma pontuação.
 */
const E_MEDIDOR_DE_FORCA = /score\s*[+|-]?=|strength/i;

/** `.min(8, ...)` dentro de um esquema zod de senha. */
const ZOD_PROPRIO = /(?:password|senha)\s*:\s*z\s*\.\s*string\(\)\s*[\s\S]{0,80}?\.min\(\s*\d+/;

const FONTE_DA_VERDADE = 'src/lib/politica-senha.ts';

/**
 * Ecrãs isentos, com o motivo:
 * · `Auth.tsx` valida o campo do formulário de LOGIN, que não define senha
 *   nenhuma — recusar ali por comprimento só esconderia "senha errada".
 */
const ISENTOS = ['src/pages/Auth.tsx'];

describe('política de senha única', () => {
  it('nenhum ecrã define a sua própria regra de senha', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      if (arquivo === FONTE_DA_VERDADE) continue;
      if (arquivo.includes('__tests__')) continue;
      if (ISENTOS.includes(arquivo)) continue;

      ler(arquivo)
        .split('\n')
        .forEach((linha, i) => {
          const t = linha.trimStart();
          if (t.startsWith('*') || t.startsWith('//')) return;
          if (E_MEDIDOR_DE_FORCA.test(linha)) return;
          if (COMPRIMENTO_PROPRIO.test(linha) || ZOD_PROPRIO.test(linha)) {
            infratores.push(`${arquivo}:${i + 1} → ${linha.trim()}`);
          }
        });
    }

    expect(
      infratores,
      'Use REGRAS_SENHA / esquemaSenha / primeiraFalha de @/lib/politica-senha.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // Sem isto, um erro na expressão faria o teste passar sempre.
    expect(COMPRIMENTO_PROPRIO.test('    minLength: newPassword.length >= 6,')).toBe(true);
    expect(COMPRIMENTO_PROPRIO.test('    if (senha.length < 8) return;')).toBe(true);
    expect(ZOD_PROPRIO.test("  password: z.string().min(8, t('x')),")).toBe(true);
    // O quarto caminho, que só apareceu porque esta guarda existia.
    expect(COMPRIMENTO_PROPRIO.test('  if (data.nova_senha.length < 6) return false;')).toBe(true);

    // E não acusa quem usa a política.
    expect(COMPRIMENTO_PROPRIO.test('  const falha = primeiraFalha(newPassword, t);')).toBe(false);
    expect(ZOD_PROPRIO.test('  password: esquemaSenha(t),')).toBe(false);
    // Nem "o campo está preenchido", que não é política.
    expect(COMPRIMENTO_PROPRIO.test('  passwordsMatch: confirmPassword.length > 0,')).toBe(false);
    // Nem o medidor de força, que mede sem impor.
    expect(E_MEDIDOR_DE_FORCA.test('  if (password.length >= 8) score += 20;')).toBe(true);
  });

  it('a política exige 8 caracteres com maiúscula, minúscula e número', () => {
    expect(SENHA_MIN).toBe(8);
    expect(REGRAS_SENHA.map((r) => r.chave)).toEqual([
      'minChars',
      'uppercase',
      'lowercase',
      'number',
    ]);

    expect(senhaValida('Akuris2026')).toBe(true);
    expect(senhaValida('123456')).toBe(false); // o que o ecrã antigo aceitava
    expect(senhaValida('akuris2026')).toBe(false); // sem maiúscula
    expect(senhaValida('AKURIS2026')).toBe(false); // sem minúscula
    expect(senhaValida('AkurisAkuris')).toBe(false); // sem número
    expect(senhaValida('Ak2026')).toBe(false); // curta

    expect(avaliarSenha('akuris')).toEqual({
      minChars: false,
      uppercase: false,
      lowercase: true,
      number: false,
    });
  });
});
