/**
 * O assistente de escopo fala a língua do ecrã — e "Não sei" é uma resposta.
 *
 * Dois defeitos do mesmo ecrã, relatados juntos.
 *
 * ## 1. Clicar em "Não sei" não fazia nada
 *
 * `responder()` mandava as respostas às travas com `nao_sei` convertido em
 * `undefined` — correcto, porque uma trava raciocina em sim/não. Mas depois
 * espalhava por cima o mapa que `aplicarTravas` devolve, e esse mapa é o que
 * ENTROU: lá dentro o `nao_sei` já era `undefined`. O espalhamento apagava a
 * resposta acabada de escolher. O botão nunca ficava marcado, o contador de
 * respondidas não subia, e o ecrã não dava sinal nenhum de ter registado.
 *
 * A correcção move a lógica para `responderComTravas`, onde só os alvos que uma
 * trava FORÇOU voltam por cima. É esse contrato que este ficheiro fixa.
 *
 * ## 2. O questionário saía em português com a aplicação em inglês
 *
 * `src/i18n/modules/gap-escopo.ts` tinha `en` e `pt` a apontar para o MESMO
 * objecto, e as perguntas nem sequer passavam pelo `t()` — estão em
 * `gap-escopo.ts`, que é português. Resultado: interface inglesa, questionário
 * português, e a justificativa — a frase que a empresa assina na Declaração de
 * Aplicabilidade — também.
 *
 * Traduzir de véspera texto de conformidade era o risco que o comentário
 * anterior invocava para não traduzir. Mas o texto não traduzido não fica
 * neutro: fica ilegível para quem o assina. A tradução vive em
 * `gap-escopo-en.ts`, fora do `t()` — que humaniza chaves em falta e poria uma
 * frase de aspecto plausível dentro de um documento assinado.
 *
 * ## 3. As intros mentiam sobre si próprias
 *
 * Encontrado ao traduzir: a intro da LGPD dizia «nove perguntas» e havia oito;
 * a do SOC 2 dizia «as seis seguintes» e havia duas, e prometia tirar «até 42
 * dos 63 requisitos» quando as suas perguntas cobrem 22 códigos. Um número
 * escrito em prosa não acompanha o array que descreve. Agora é `{n}`, contado.
 */
import { describe, it, expect } from 'vitest';
import {
  ESCOPO_POR_FRAMEWORK, escopoDe, responderComTravas, semNaoSei, codigosExcluidos,
} from '@/lib/gap-escopo';
import { ESCOPO_EN } from '@/lib/gap-escopo-en';
import { gapEscopo } from '@/i18n/modules/gap-escopo';

const CHAVES = Object.keys(ESCOPO_POR_FRAMEWORK);

describe('"Não sei" é uma resposta', () => {
  const iso = ESCOPO_POR_FRAMEWORK.iso27001;

  it('fica registada', () => {
    const { respostas } = responderComTravas(iso, {}, 'servicos_em_nuvem', 'nao_sei');
    expect(respostas.servicos_em_nuvem).toBe('nao_sei');
  });

  it('sobrevive a uma trava disparada por outra pergunta', () => {
    /* O caso exacto que estava partido: a trava de `instalacoes_proprias: nao`
       força duas outras perguntas, e o mapa que ela devolve tem o `nao_sei`
       como `undefined`. Se voltar inteiro por cima, a resposta desaparece. */
    let r = responderComTravas(iso, {}, 'codigo_fonte_proprio', 'nao_sei').respostas;
    r = responderComTravas(iso, r, 'instalacoes_proprias', 'nao').respostas;

    expect(r.codigo_fonte_proprio, 'a resposta anterior foi apagada pela trava').toBe('nao_sei');
    expect(r.instalacoes_proprias).toBe('nao');
    // E a trava fez o que devia.
    expect(r.trabalho_fora_das_instalacoes).toBe('sim');
    expect(r.servicos_em_nuvem).toBe('sim');
  });

  it('conta como respondida', () => {
    /* O contador do ecrã filtra por `respostas[p.id]` ser verdadeiro. Enquanto
       o valor era apagado, ficava sempre em "0 de 9 respondidas". */
    let r: Record<string, 'sim' | 'nao' | 'nao_sei' | undefined> = {};
    for (const p of iso.perguntas) r = responderComTravas(iso, r, p.id, 'nao_sei').respostas;
    expect(iso.perguntas.filter((p) => r[p.id]).length).toBe(iso.perguntas.length);
  });

  it('não exclui requisito nenhum', () => {
    /* Na dúvida não se exclui: lista maior é chatice, exclusão indevida é
       reprovação. "Não sei" tem de sair da conta, não entrar como "não". */
    const r: Record<string, 'nao_sei'> = Object.fromEntries(
      iso.perguntas.map((p) => [p.id, 'nao_sei' as const]),
    );
    expect(codigosExcluidos(iso, semNaoSei(r))).toEqual([]);
  });

  it('trocar "não sei" por "não" volta a excluir', () => {
    const r = responderComTravas(iso, { desenvolvimento_interno: 'nao_sei' },
      'desenvolvimento_interno', 'nao').respostas;
    expect(codigosExcluidos(iso, semNaoSei(r)).length).toBeGreaterThan(0);
  });
});

describe('o questionário existe em inglês', () => {
  it('todo o framework com assistente tem bloco inglês', () => {
    expect(CHAVES.filter((k) => !ESCOPO_EN[k])).toEqual([]);
  });

  it('toda a pergunta tem tradução, campo a campo', () => {
    const falhas: string[] = [];
    for (const chave of CHAVES) {
      const en = ESCOPO_EN[chave];
      for (const p of ESCOPO_POR_FRAMEWORK[chave].perguntas) {
        const t = en?.perguntas[p.id];
        if (!t) { falhas.push(`${chave}/${p.id}: sem tradução`); continue; }
        for (const campo of ['pergunta', 'ajuda', 'justificativa', 'nuncaExcluir', 'aviso'] as const) {
          if (p[campo] && !t[campo]) falhas.push(`${chave}/${p.id}.${campo}: falta em inglês`);
        }
      }
    }
    expect(falhas, 'src/lib/gap-escopo-en.ts').toEqual([]);
  });

  it('nenhum texto inglês é o português copiado', () => {
    const falhas: string[] = [];
    for (const chave of CHAVES) {
      const en = ESCOPO_EN[chave];
      if (en.intro === ESCOPO_POR_FRAMEWORK[chave].intro) falhas.push(`${chave}/intro`);
      for (const p of ESCOPO_POR_FRAMEWORK[chave].perguntas) {
        const t = en.perguntas[p.id];
        for (const campo of ['pergunta', 'ajuda', 'justificativa', 'nuncaExcluir', 'aviso'] as const) {
          if (t?.[campo] && t[campo] === p[campo]) falhas.push(`${chave}/${p.id}.${campo}`);
        }
      }
    }
    expect(falhas).toEqual([]);
  });

  it('toda a trava explica-se em inglês', () => {
    const falhas: string[] = [];
    for (const chave of CHAVES) {
      for (const tr of ESCOPO_POR_FRAMEWORK[chave].travas ?? []) {
        const k = `${tr.se[0]}>${tr.entao[0]}`;
        if (!ESCOPO_EN[chave].travas?.[k]) falhas.push(`${chave}: ${k}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('`escopoDe` entrega inglês quando o pedem, e não mistura', () => {
    for (const chave of CHAVES) {
      const en = escopoDe(chave, 'en')!;
      const pt = escopoDe(chave, 'pt')!;
      expect(en.perguntas.length).toBe(pt.perguntas.length);
      for (let i = 0; i < en.perguntas.length; i++) {
        expect(en.perguntas[i].id).toBe(pt.perguntas[i].id);
        expect(en.perguntas[i].pergunta).not.toBe(pt.perguntas[i].pergunta);
        expect(en.perguntas[i].justificativa).not.toBe(pt.perguntas[i].justificativa);
        // Os códigos são da norma, não da língua.
        expect(en.perguntas[i].codigos).toEqual(pt.perguntas[i].codigos);
      }
    }
  });

  it('sem idioma pedido continua a devolver português', () => {
    // Há chamadores antigos com um argumento só.
    expect(escopoDe('iso27001')!.perguntas[0].pergunta)
      .toBe(escopoDe('iso27001', 'pt')!.perguntas[0].pergunta);
  });

  it('os rótulos ingleses não são os portugueses', () => {
    const pt = gapEscopo.pt.gapEscopo as Record<string, unknown>;
    const en = gapEscopo.en.gapEscopo as Record<string, unknown>;
    expect(en, 'en e pt apontavam para o mesmo objecto').not.toBe(pt);

    const falhas: string[] = [];
    const comparar = (a: Record<string, unknown>, b: Record<string, unknown>, caminho = '') => {
      for (const k of Object.keys(a)) {
        const va = a[k], vb = b[k];
        if (typeof va === 'object' && va) {
          comparar(va as Record<string, unknown>, (vb ?? {}) as Record<string, unknown>, `${caminho}${k}.`);
        } else if (va === vb) falhas.push(`${caminho}${k}`);
      }
    };
    comparar(pt, en);
    expect(falhas, 'src/i18n/modules/gap-escopo.ts').toEqual([]);
  });
});

describe('a intro conta as perguntas que existem', () => {
  it('nas duas línguas, e sem deixar o marcador cru', () => {
    for (const chave of CHAVES) {
      const n = ESCOPO_POR_FRAMEWORK[chave].perguntas.length;
      for (const idioma of ['pt', 'en'] as const) {
        const intro = escopoDe(chave, idioma)!.intro;
        expect(intro, `${chave}/${idioma}`).not.toContain('{n}');
        expect(intro, `${chave}/${idioma}`).toContain(String(n));
      }
    }
  });

  it('nenhuma intro escreve o número por extenso', () => {
    /* Foi assim que as três se desactualizaram sem ninguém dar por isso. */
    const EXTENSO = /\b(uma|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+perguntas\b/i;
    const falhas: string[] = [];
    for (const chave of CHAVES) {
      if (EXTENSO.test(ESCOPO_POR_FRAMEWORK[chave].intro)) falhas.push(`${chave}/pt`);
      if (/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+questions\b/i.test(ESCOPO_EN[chave].intro)) {
        falhas.push(`${chave}/en`);
      }
    }
    expect(falhas, 'use {n} — o número vem do array').toEqual([]);
  });
});
