/**
 * A base legal é o artefacto de conformidade do módulo de Privacidade: é o que
 * a ROPA leva à autoridade. A lei separa as hipóteses por sensibilidade — LGPD
 * Art. 7 para dado comum e Art. 11 para dado sensível; RGPD Art. 6 e Art. 9 —
 * e o produto oferecia uma lista única de sete opções para tudo.
 *
 * O resultado era gravável, listável e exportável: "Biometria — Legítimo
 * Interesse", hipótese que a LGPD não admite para dado sensível.
 */
import { describe, expect, it } from 'vitest';
import {
  BASES_LEGAIS,
  basesLegaisAplicaveis,
  avaliarBaseLegal,
  ehDadoSensivel,
  JURISDICOES,
} from '@/lib/jurisdicao';
import { pt } from '@/i18n/pt';
import { modulesPt, modulesEn } from '@/i18n/modules';
import { localizePtDictionary } from '@/lib/pt-variants';

describe('bases legais por sensibilidade', () => {
  it('legítimo interesse não serve para dado sensível em nenhuma jurisdição', () => {
    for (const codigo of JURISDICOES) {
      expect(
        basesLegaisAplicaveis(codigo, 'sensivel'),
        `${codigo}: legítimo interesse não é hipótese para dado sensível`,
      ).not.toContain('legitimo_interesse');
    }
  });

  it('execução de contrato também não serve para dado sensível', () => {
    for (const codigo of JURISDICOES) {
      expect(basesLegaisAplicaveis(codigo, 'sensivel')).not.toContain('execucao_contrato');
    }
  });

  it('"muito sensível" conta como sensível', () => {
    expect(ehDadoSensivel('muito_sensivel')).toBe(true);
    expect(ehDadoSensivel('sensivel')).toBe(true);
    expect(ehDadoSensivel('comum')).toBe(false);
    expect(ehDadoSensivel(null)).toBe(false);
  });

  it('a LGPD tem as dez hipóteses do Art. 7 para dado comum', () => {
    expect(BASES_LEGAIS.BR.comuns).toHaveLength(10);
    // As três que faltavam nos formulários e existiam só no mapa de rótulos.
    expect(BASES_LEGAIS.BR.comuns).toContain('tutela_saude');
    expect(BASES_LEGAIS.BR.comuns).toContain('protecao_credito');
    expect(BASES_LEGAIS.BR.comuns).toContain('estudo_pesquisa');
  });

  it('prevenção à fraude só existe para dado sensível (Art. 11)', () => {
    expect(BASES_LEGAIS.BR.sensiveis).toContain('prevencao_fraude');
    expect(BASES_LEGAIS.BR.comuns).not.toContain('prevencao_fraude');
  });

  it('distingue base ilícita de base inexistente', () => {
    // Existe na lei, mas não para dado sensível.
    expect(avaliarBaseLegal('BR', 'legitimo_interesse', 'sensivel')).toBe('incompativel');
    // A mesma base, em dado comum, é perfeitamente lícita.
    expect(avaliarBaseLegal('BR', 'legitimo_interesse', 'comum')).toBe('ok');
    // A LGPD não prevê "interesse público" como hipótese autónoma.
    expect(avaliarBaseLegal('BR', 'interesse_publico', 'comum')).toBe('desconhecida');
    expect(avaliarBaseLegal('BR', null, 'comum')).toBe('desconhecida');
  });

  it('toda base oferecida tem rótulo nos dois idiomas', () => {
    const chaves = new Set(
      JURISDICOES.flatMap((c) => [...BASES_LEGAIS[c].comuns, ...BASES_LEGAIS[c].sensiveis]),
    );
    for (const chave of chaves) {
      expect((modulesPt as any).jurisdicao?.basesLegais?.[chave], `PT: ${chave}`).toBeTruthy();
      expect((modulesEn as any).jurisdicao?.basesLegais?.[chave], `EN: ${chave}`).toBeTruthy();
    }
  });

  it('o ramo isento ja vem em pt-BR, porque ninguem o vai corrigir', () => {
    // O preco da isencao: o normalizador deixou de arrumar estes textos, logo
    // um "partilha" escrito aqui chega tal e qual ao ecra brasileiro. Aconteceu
    // no direito do Art. 18, VII assim que a isencao entrou.
    const ptPt = new RegExp(
      String.raw`\b(partilha|partilhado|utilizador|utilizadores|ficheiro|registo|guardar)\b`,
      'i',
    );

    // A guarda tem de morder — e NAO pode morder em "compartilhamento", que
    // contem "partilha" no meio da palavra. Sem estas duas linhas um escape
    // perdido transformava o teste num que passa sempre: foi o que aconteceu
    // na primeira versao, onde o \b virou um caractere de backspace.
    expect(ptPt.test('Informacao sobre partilha de dados')).toBe(true);
    expect(ptPt.test('Informacao sobre compartilhamento de dados')).toBe(false);

    const ramos = [
      (modulesPt as any).jurisdicao?.basesLegais ?? {},
      (modulesPt as any).jurisdicao?.direitos ?? {},
    ];
    expect(Object.keys(ramos[0]).length, 'ramo basesLegais vazio: o caminho mudou').toBeGreaterThan(0);
    expect(Object.keys(ramos[1]).length, 'ramo direitos vazio: o caminho mudou').toBeGreaterThan(0);

    const infratores = ramos.flatMap((ramo) =>
      Object.entries(ramo)
        .filter(([, v]) => typeof v === 'string' && ptPt.test(v as string))
        .map(([k, v]) => `${k}: ${v}`),
    );
    expect(infratores, 'Escreva em pt-BR: este ramo nao passa pelo normalizador.').toEqual([]);
  });

  it('o normalizador de variantes não reescreve a letra da lei', () => {
    // `pesquisa ⇄ busca` está certo para procurar e errado para "órgão de
    // pesquisa", que é a redacção do Art. 7.º, IV. Terminologia legal fica fora.
    const base: any = { ...pt, ...modulesPt };
    const br: any = localizePtDictionary(base, 'pt-BR');
    expect(br.jurisdicao.basesLegais.estudo_pesquisa).toContain('pesquisa');
    expect(br.jurisdicao.basesLegais.estudo_pesquisa).not.toContain('busca');
  });
});
