/**
 * O dicionário inglês não é o português com outro nome.
 *
 * Dois módulos foram apanhados a fingir paridade:
 *
 *  · `gapEscopo` — `en` e `pt` eram literalmente o MESMO objecto. Com a
 *    aplicação em inglês, o assistente de escopo saía inteiro em português,
 *    incluindo a justificativa que a empresa assina na Declaração de
 *    Aplicabilidade.
 *
 *  · `gapFases` — os sete rótulos estavam traduzidos e as 48 frases das fases
 *    não. O ecrã dizia "Work plan" e a seguir "Escopo fechado".
 *
 * Os dois tinham um comentário a explicar que repetir o português era uma
 * decisão: mantinha a paridade de CHAVES, e traduzir texto de conformidade à
 * pressa era pior. O raciocínio tem metade de razão — a pressa é mesmo má —
 * mas a conclusão não se sustenta: o texto por traduzir não fica neutro, fica
 * ilegível para quem o vai assinar. Nenhum dos dois defeitos foi apanhado por
 * `chave-de-traducao-existe`, que compara chaves e não conteúdo.
 *
 * ## O que esta guarda mede, e o que não mede
 *
 * Não exige que toda a frase inglesa seja diferente da portuguesa: "Gap
 * Analysis", "Due Diligence", "API Keys", "Status *" e "{count} req." são
 * iguais nas duas línguas de propósito, e são 87 em quase 12 mil folhas.
 *
 * Mede SUBÁRVORES: um bloco com quatro ou mais frases traduzíveis em que 60%
 * ou mais são idênticas não é coincidência, é um bloco por traduzir. Os dois
 * casos acima estavam a 100%. Hoje não sobra nenhum, nem sequer baixando o
 * limiar para 30% — a margem é larga porque a guarda deve acusar o módulo
 * inteiro esquecido, não o estrangeirismo solto.
 */
import { describe, it, expect } from 'vitest';
import { modulesPt, modulesEn } from '@/i18n/modules';
import { pt } from '@/i18n/pt';
import { en } from '@/i18n/en';

/** A partir de quantas frases um bloco deixa de ser coincidência. */
const MINIMO_DE_FRASES = 4;
/** Que fatia de frases idênticas denuncia um bloco por traduzir. */
const LIMIAR = 0.6;

type Arvore = Record<string, unknown>;

function folhas(o: unknown): string[] {
  const r: string[] = [];
  for (const k of Object.keys((o ?? {}) as Arvore)) {
    const v = (o as Arvore)[k];
    if (typeof v === 'string') r.push(v);
    else if (v && typeof v === 'object') r.push(...folhas(v));
  }
  return r;
}

/* Siglas, nomes próprios e cadeias só de marcadores ("{count}") coincidem sem
   que ninguém tenha falhado nada. Exige-se espaço e uma palavra de verdade. */
const traduzivel = (s: string) => /\s/.test(s) && /[a-zA-Z]{4}/.test(s);

function varrer(a: unknown, b: unknown, caminho: string, saida: string[]) {
  const nossas = folhas(a).filter(traduzivel);
  if (nossas.length >= MINIMO_DE_FRASES) {
    const deles = folhas(b).filter(traduzivel);
    const iguais = nossas.filter((x, i) => deles[i] === x).length;
    if (iguais / nossas.length >= LIMIAR) {
      // Acusa o bloco e pára: descer mais só repetiria o mesmo achado.
      saida.push(`${caminho} — ${iguais} de ${nossas.length} frases estão em português`);
      return;
    }
  }
  for (const k of Object.keys((a ?? {}) as Arvore)) {
    const filho = (a as Arvore)[k];
    if (filho && typeof filho === 'object') {
      varrer(filho, (b as Arvore | undefined)?.[k], `${caminho}.${k}`, saida);
    }
  }
}

describe('o inglês é inglês', () => {
  it('nenhum bloco do dicionário ficou por traduzir', () => {
    const achados: string[] = [];
    varrer(modulesPt, modulesEn, 'modules', achados);
    varrer(pt, en, 'raiz', achados);
    expect(
      achados,
      'Traduza o bloco em src/i18n/. Repetir o português mantém a paridade de chaves e nenhuma paridade de língua.',
    ).toEqual([]);
  });

  it('a guarda reprova um bloco copiado', () => {
    /* Sem isto, uma guarda que nunca acusa passa por guarda. */
    const portugues = {
      m: { a: 'Escopo fechado do projeto', b: 'Programa no papel aprovado',
           c: 'Controles no ar em produção', d: 'Pronto para o certificado' },
    };
    const achados: string[] = [];
    varrer(portugues, portugues, 'copiado', achados);
    /* Acusa o bloco mais EXTERNO que passa do limiar: dizer «traduz este
       modulo» e mais util do que apontar cada folha la dentro. */
    expect(achados).toEqual(['copiado — 4 de 4 frases estão em português']);
  });
});
