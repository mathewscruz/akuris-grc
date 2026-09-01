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

  it('toda a entrada do catálogo tem quem a chame', () => {
    /*
       A regra ao contrário, e custou uma fachada: `calculate-assessment-score`
       estava publicada, configurada, listada aqui como cobrável -- e não era
       chamada por ninguém. O painel Financeiro IA anunciava ao administrador
       uma funcionalidade que não corre, e o utilizador nunca a via gastar
       nada porque ela nunca gastou.

       Uma entrada no catálogo é uma promessa de que aquilo existe e cobra.
    */
    const fontes: string[] = [];
    /*
       O catálogo e os testes ficam de FORA do corpus.

       Sem isto a guarda satisfazia-se a si própria: a entrada
       `edgeFunction: 'nome',` do catálogo tem a forma de um argumento, e
       contava como se alguém a chamasse. Verificado -- com a órfã reposta, a
       guarda passava na mesma.
    */
    const andar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const caminho = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== '__tests__') andar(caminho);
        } else if (/\.(ts|tsx)$/.test(e.name) && !caminho.endsWith('ai-usage-catalog.ts')) {
          fontes.push(readFileSync(caminho, 'utf8'));
        }
      }
    };
    andar('src');
    andar(RAIZ);
    const tudo = fontes.join('\n');

    /*
       `dashboard-ai-summary` corre em produção e NÃO tem código neste
       repositório -- foi publicada por fora. Fica no catálogo de propósito:
       enquanto cobrar, o painel tem de saber o modelo dela, senão o custo vira
       palpite. Sai daqui quando for removida da implantação.
    */
    const SEM_CODIGO_NO_REPO = new Set(['dashboard-ai-summary']);

    const orfas = AI_FEATURES.filter((f) => {
      if (SEM_CODIGO_NO_REPO.has(f.edgeFunction)) return false;
      /* O nome pode vir na linha do `invoke(`, na linha seguinte (é o que o
         `invokeEdgeFunction` faz com três das funções), ou dentro de um URL
         `/functions/v1/...` -- a `akuria-chat` responde em fluxo e é chamada
         assim. Uma leitura por linha dava três falsos positivos. */
      const aspas = String.raw`['"` + '`' + ']';
      const porInvoke = new RegExp(String.raw`invoke\w*\(\s*` + aspas + f.edgeFunction + aspas);
      const porUrl = new RegExp(String.raw`functions/v1/` + f.edgeFunction + '(?![\\w-])');
      const porArgumento = new RegExp(aspas + f.edgeFunction + aspas + String.raw`\s*,`);
      return !porInvoke.test(tudo) && !porUrl.test(tudo) && !porArgumento.test(tudo);
    }).map((f) => f.edgeFunction);

    expect(
      orfas,
      'Entrada no catálogo sem quem a chame: ou se liga a função, ou sai daqui.',
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
