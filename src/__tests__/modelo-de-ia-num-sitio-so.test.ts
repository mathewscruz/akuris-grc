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
 * mecânico, padrão, leitura longa — e não por função. Trocar é uma linha.
 *
 * Nenhuma fica de fora: a `docgen-chat` e a `generate-email-content` escolhem
 * entre vários níveis a cada pedido, e essa lógica é delas — mas os níveis
 * vem daqui na mesma.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const RAIZ = 'supabase/functions';

/** Escolhem o modelo por conta própria, com razão declarada. */
const ISENTAS = new Set<string>();

/*
   Onde o modelo é ESCOLHIDO: um `model:` num corpo de pedido, ou uma constante
   guardada para depois. Comparar prefixos não é escolher — a `docgen-chat`
   pergunta `model.startsWith('openai/gpt-5')` porque essa família recusa
   `max_tokens`, e isso tem de continuar a poder ser escrito.
*/
const ESCOLHA_DE_MODELO =
  /(?:\bmodel\s*:|\bMODEL[A-Z_]*\s*=)\s*['"`](google|openai|anthropic)\/[a-z0-9.-]+['"`]/i;

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
        const m = ESCOLHA_DE_MODELO.exec(linha);
        if (m) falhas.push(`${nome}:${i + 1} → ${m[0]}`);
      });
    }
    expect(
      falhas,
      'Use `MODELOS.MECANICO` / `PADRAO` / `LEITURA_LONGA` de `_shared/modelos.ts`.',
    ).toEqual([]);
  });

  it('o ficheiro das escolhas continua a ser o único a nomear modelos', () => {
    const fonte = readFileSync(`${RAIZ}/_shared/modelos.ts`, 'utf8');
    for (const escolha of ['MECANICO', 'PADRAO', 'LEITURA_LONGA', 'IMAGEM', 'RESERVA']) {
      expect(fonte.includes(escolha), `Falta a escolha ${escolha}.`).toBe(true);
    }
  });

  it('a reserva fica noutro fornecedor', () => {
    /* Uma avaria do primeiro fornecedor não pode parar o produto — e é o
       ÚNICO ponto onde entra um segundo, de propósito. */
    const fonte = readFileSync(`${RAIZ}/_shared/modelos.ts`, 'utf8');
    const reserva = /RESERVA:\s*'([^']+)'/.exec(fonte)?.[1] ?? '';
    const padrao = /PADRAO:\s*'([^']+)'/.exec(fonte)?.[1] ?? '';
    expect(
      reserva.split('/')[0],
      'A reserva no mesmo fornecedor não é reserva nenhuma.',
    ).not.toBe(padrao.split('/')[0]);
  });
});
