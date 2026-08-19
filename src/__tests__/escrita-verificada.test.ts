/**
 * Nenhuma escrita no Supabase pode ignorar o resultado.
 *
 * O cliente do Supabase **não lança**: devolve `{ data, error }`. Por isso
 *
 *   try {
 *     await supabase.from('api_inbound_webhooks').delete().eq('id', id);
 *     toast.success('Removido');
 *   } catch (e) { ... }
 *
 * mostra "Removido" mesmo quando a base recusou — o `catch` nunca corre.
 * Trinta e três escritas do produto estavam assim. Seis delas eram recusadas
 * SEMPRE (inserção em `notifications`, que não tem policy de INSERT), o que
 * significa que o aprovador de um risco nunca era avisado e a menção num
 * comentário de controlo nunca chegava a ninguém.
 *
 * As formas aceites são duas:
 *   · `const { error } = await supabase...` seguido do teste do erro;
 *   · `await exigirEscrita(supabase...)`, de `@/lib/supabase-write`.
 *
 * LIMITE conhecido, que este teste não cobre: UPDATE e DELETE recusados pela
 * RLS devolvem `error: null` e zero linhas. Para esses casos há `exigirLinhas`,
 * mas exige `.select()` na cadeia e ainda não está aplicado em todo o lado.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';

const OPERACAO = /\.(insert|update|delete|upsert)\s*\(/;

/**
 * Do índice dado até ao `;` que fecha a expressão, respeitando aninhamento e
 * literais de texto. Sem isto, uma cadeia de várias linhas seria cortada no
 * primeiro `;` que aparecesse dentro de um objeto.
 */
function fimDaExpressao(s: string, i: number): number {
  let profundidade = 0;
  let aspas: string | null = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (aspas) {
      if (c === '\\') { j++; continue; }
      if (c === aspas) aspas = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') aspas = c;
    else if (c === '(' || c === '[' || c === '{') profundidade++;
    else if (c === ')' || c === ']' || c === '}') {
      profundidade--;
      if (profundidade < 0) return -1;
    } else if (c === ';' && profundidade === 0) return j;
  }
  return -1;
}

/**
 * Recua até ao início da instrução: o caractere a seguir ao último `;`, `{` ou
 * `}` antes do ponto dado. É o que permite ver a atribuição de um ternário
 * partido por várias linhas.
 */
function inicioDaInstrucao(s: string, i: number): number {
  for (let j = i - 1; j >= 0; j--) {
    const c = s[j];
    if (c === ';' || c === '{' || c === '}') return j + 1;
  }
  return 0;
}

/** `arquivo:linha` de cada escrita cujo resultado é descartado. */
export function escritasSemVerificacao(texto: string, arquivo: string): string[] {
  const achados: string[] = [];
  let pos = 0;
  for (;;) {
    const i = texto.indexOf('await supabase', pos);
    if (i < 0) break;
    pos = i + 1;

    // O prefixo tem de ser o da INSTRUÇÃO, não o da linha: num ternário
    //
    //   const { error } = plano
    //     ? await supabase.from('planos').update(...)
    //     : await supabase.from('planos').insert(...);
    //
    // a linha do `await` começa em `?` e pareceria descarte, quando o erro
    // está a ser recolhido duas linhas acima.
    const prefixo = texto.slice(inicioDaInstrucao(texto, i), i);
    // `const { error } = await ...` e `return await ...` entregam o resultado
    // a quem chamou; não são descarte.
    if (prefixo.includes('=') || prefixo.includes('return')) continue;

    const fim = fimDaExpressao(texto, i);
    if (fim < 0) continue;
    const expressao = texto.slice(i, fim);
    if (!OPERACAO.test(expressao)) continue;

    const linha = texto.slice(0, i).split('\n').length;
    achados.push(`${arquivo}:${linha} → ${expressao.split('\n')[0].trim()}`);
  }
  return achados;
}

describe('escrita no Supabase sempre verificada', () => {
  it('nenhuma escrita descarta o resultado', () => {
    const infratores = fontes()
      .filter((f) => !f.includes('__tests__'))
      .flatMap((f) => escritasSemVerificacao(ler(f), f));

    expect(
      infratores,
      'O cliente do Supabase não lança. Use `const { error } = await ...` ' +
        'e teste o erro, ou envolva em `exigirEscrita(...)` de @/lib/supabase-write.',
    ).toEqual([]);
  });

  it('a guarda enxerga o padrão que proíbe', () => {
    // Sem isto, um erro na deteção faria o teste passar sempre.
    const mau = "  await supabase.from('x').delete().eq('id', id);\n";
    expect(escritasSemVerificacao(mau, 'f.ts')).toHaveLength(1);

    // Cadeia de várias linhas, com `;` dentro do objeto de dados.
    const mauLongo = [
      "  await supabase.from('x').insert({",
      '    a: 1,',
      "    b: 'c;d',",
      '  });',
      '',
    ].join('\n');
    expect(escritasSemVerificacao(mauLongo, 'f.ts')).toHaveLength(1);

    // E as duas formas corretas não são acusadas.
    const boa1 = "  const { error } = await supabase.from('x').delete().eq('id', id);\n";
    const boa2 = "  await exigirEscrita(supabase.from('x').delete().eq('id', id));\n";
    expect(escritasSemVerificacao(boa1, 'f.ts')).toEqual([]);
    expect(escritasSemVerificacao(boa2, 'f.ts')).toEqual([]);

    // Uma leitura também não.
    const leitura = "  await supabase.from('x').select('id');\n";
    expect(escritasSemVerificacao(leitura, 'f.ts')).toEqual([]);

    // Nem o ternário cuja atribuição está numa linha anterior.
    const ternario = [
      '  const { error } = plano',
      "    ? await supabase.from('planos').update(payload).eq('id', plano.id)",
      "    : await supabase.from('planos').insert(payload);",
      '',
    ].join('\n');
    expect(escritasSemVerificacao(ternario, 'f.ts')).toEqual([]);
  });
});
