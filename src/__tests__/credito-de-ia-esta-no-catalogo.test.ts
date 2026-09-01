/**
 * Toda a IA que se cobra aparece no painel, e nenhuma corre sem franquia.
 *
 * Três regras sobre o mesmo tema, verificadas contra o código das Edge
 * Functions — que é onde o dinheiro se gasta.
 *
 * **1. Quem debita está no catálogo.** O painel Financeiro IA descobre o
 * modelo (e portanto o custo) pela `funcionalidade` gravada em
 * `creditos_consumo`. Uma que não esteja no catálogo cai num balde de
 * «modelo desconhecido» com preço por omissão: o consumo aparece, o custo é
 * um palpite. Aconteceu com `avaliar_fornecedor_ia` e `dashboard_ai_summary`.
 *
 * **2. Ninguém chama o modelo sem perguntar pela franquia.** A chamada custa
 * no instante em que sai. Treze das quinze funções chamavam primeiro e
 * perguntavam depois — e ignoravam a resposta.
 *
 * **3. Quem debita honra o retorno.** `consume_ai_credit` devolve `false`
 * quando a franquia acabou. Ignorar isso é entregar IA acima do plano e não
 * registar nada: consumo invisível no painel.
 *
 * A `akuria-chat` responde em fluxo e o débito nem é esperado — ali só a
 * trava prévia existe, e é por isso que a regra 3 a dispensa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { AI_FEATURES } from '@/lib/ai-usage-catalog';

const RAIZ = 'supabase/functions';

/** Funções que chamam a passagem de IA. */
function funcoesComIA(): { nome: string; fonte: string }[] {
  return readdirSync(RAIZ)
    .filter((n) => !n.startsWith('_') && existsSync(`${RAIZ}/${n}/index.ts`))
    .map((nome) => ({ nome, fonte: readFileSync(`${RAIZ}/${nome}/index.ts`, 'utf8') }))
    .filter((f) => f.fonte.includes('ai.gateway.lovable.dev') || f.fonte.includes('AI_GATEWAY_URL'));
}

const CHAVES = new Set(AI_FEATURES.map((f) => f.key));
/** O produto grava `chave:acao`; o catálogo indexa pelo prefixo. */
const prefixo = (f: string) => f.split(':')[0];

describe('crédito de IA', () => {
  it('toda a funcionalidade debitada existe no catálogo', () => {
    const falhas: string[] = [];
    for (const { nome, fonte } of funcoesComIA()) {
      for (const m of fonte.matchAll(/p_funcionalidade:\s*[`'"]([^`'"]+)/g)) {
        const chave = prefixo(m[1].replace(/\$\{.*/, ''));
        if (!chave || chave.includes('${')) continue;
        if (!CHAVES.has(chave)) falhas.push(`${nome} → ${chave}`);
      }
    }
    expect(
      falhas,
      'Sem entrada no catálogo, o custo desta IA vira palpite no painel Financeiro IA.',
    ).toEqual([]);
  });

  it('ninguém chama o modelo sem perguntar pela franquia', () => {
    const falhas: string[] = [];
    for (const { nome, fonte } of funcoesComIA()) {
      // A `docgen-chat` tem cobrança idempotente e estorno próprios.
      if (nome === 'docgen-chat') continue;
      if (!fonte.includes('temCreditoIA')) falhas.push(nome);
    }
    expect(
      falhas,
      'A chamada ao modelo custa no instante em que sai: pergunte pela franquia ANTES (`_shared/creditos.ts`).',
    ).toEqual([]);
  });

  it('quem debita honra o retorno de `consume_ai_credit`', () => {
    const falhas: string[] = [];
    for (const { nome, fonte } of funcoesComIA()) {
      if (nome === 'docgen-chat' || nome === 'akuria-chat') continue;
      if (!fonte.includes("rpc('consume_ai_credit'")) continue;
      const honra = /(creditoOk|creditOk|creditResult|batchCredit|data) === false/.test(fonte);
      if (!honra) falhas.push(nome);
    }
    expect(
      falhas,
      '`consume_ai_credit` devolve `false` com a franquia esgotada. Ignorar é entregar IA fora do plano e não registar nada.',
    ).toEqual([]);
  });
});
