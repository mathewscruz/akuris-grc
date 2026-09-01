/**
 * O modelo escolhe-se num sítio só.
 *
 * Estava escrito à mão em cada função, e o produto acabou com **seis** modelos
 * diferentes em produção — `2.5-flash`, `2.5-flash-lite`, `3-flash-preview`,
 * `3.1-flash-lite`, `3.1-pro-preview` e `3.6-flash`. Trocar de modelo era
 * editar quinze ficheiros e descobrir o décimo sexto mais tarde; e comparar
 * custo entre funcionalidades exigia ler quinze ficheiros.
 *
 * Agora vem de `_shared/modelos.ts`, escolhido por **feitio do trabalho** —
 * extração, redação, leitura longa — e não por função. Trocar é uma linha.
 *
 * A `docgen-chat` fica de fora: escolhe entre rápido, bom e reserva conforme o
 * pedido, e essa lógica é dela. A `generate-email-content` também, por agora:
 * usa três modelos, um deles de imagem, e a migração dela é decisão à parte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const RAIZ = 'supabase/functions';

/** Escolhem o modelo por conta própria, com razão declarada. */
const ISENTAS = new Set(['docgen-chat', 'generate-email-content']);

/** Qualquer nome de modelo de um fornecedor conhecido. */
const NOME_DE_MODELO = /['"`](google|openai|anthropic)\/[a-z0-9.\-]+['"`]/i;

function funcoesComIA() {
  return readdirSync(RAIZ)
    .filter((n) => !n.startsWith('_') && existsSync(`${RAIZ}/${n}/index.ts`))
    .map((nome) => ({ nome, fonte: readFileSync(`${RAIZ}/${nome}/index.ts`, 'utf8') }))
    .filter((f) => f.fonte.includes('ai.gateway.lovable.dev') || f.fonte.includes('AI_GATEWAY_URL'));
}

describe('escolha de modelo', () => {
  it('nenhuma função escreve o nome do modelo à mão', () => {
    const falhas: string[] = [];
    for (const { nome, fonte } of funcoesComIA()) {
      if (ISENTAS.has(nome)) continue;
      fonte.split('\n').forEach((linha, i) => {
        const t = linha.trim();
        // Um comentário a EXPLICAR o defeito não é o defeito.
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        const m = NOME_DE_MODELO.exec(linha);
        if (m) falhas.push(`${nome}:${i + 1} → ${m[0]}`);
      });
    }
    expect(
      falhas,
      'Use `MODELOS.EXTRACAO` / `REDACAO` / `LEITURA_LONGA` de `_shared/modelos.ts`.',
    ).toEqual([]);
  });

  it('o ficheiro das escolhas continua a ser o único a nomear modelos', () => {
    const fonte = readFileSync(`${RAIZ}/_shared/modelos.ts`, 'utf8');
    for (const escolha of ['EXTRACAO', 'REDACAO', 'LEITURA_LONGA', 'RESERVA']) {
      expect(fonte.includes(escolha), `Falta a escolha ${escolha}.`).toBe(true);
    }
  });

  it('a reserva fica noutro fornecedor', () => {
    /* Uma avaria do primeiro fornecedor não pode parar o produto — e é o
       ÚNICO ponto onde entra um segundo, de propósito. */
    const fonte = readFileSync(`${RAIZ}/_shared/modelos.ts`, 'utf8');
    const reserva = /RESERVA:\s*'([^']+)'/.exec(fonte)?.[1] ?? '';
    const extracao = /EXTRACAO:\s*'([^']+)'/.exec(fonte)?.[1] ?? '';
    expect(
      reserva.split('/')[0],
      'A reserva no mesmo fornecedor não é reserva nenhuma.',
    ).not.toBe(extracao.split('/')[0]);
  });
});
