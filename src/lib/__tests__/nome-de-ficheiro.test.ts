/**
 * O título que a IA devolve nem sempre serve como nome de ficheiro.
 *
 * Medido nos 22 documentos gerados da base de desenvolvimento:
 *
 *   - **três passam dos 100 caracteres**, o maior com 208, porque o modelo
 *     devolveu o briefing inteiro no campo `titulo`;
 *   - **três trazem caracteres ilegais num nome de ficheiro** — a barra de
 *     «RTO/RPO» e de «provisionamento/desprovisionamento», e o `**` de
 *     markdown que escapou do negrito.
 *
 * E o DocGen usava-o tal e qual: `a.download = titulo + '.pdf'`.
 *
 * Os casos abaixo são os títulos REAIS, copiados da base — não inventados.
 */
import { describe, expect, it } from 'vitest';
import { MAX_NOME, nomeDeFicheiroSeguro, tituloCurto } from '../nome-de-ficheiro';

/** Títulos verdadeiros, tal como estão em `docgen_generated_docs.conteudo`. */
const REAIS = {
  comBarra:
    'Plano de Continuidade de Negócios (BCP) com BIA, processos críticos, RTO/RPO, estratégias de continuidade, equipe de crise, comunicação e cronograma de testes.',
  comBarraLongo:
    'Política de Controle de Acesso baseada em menor privilégio, segregação de funções, processo de provisionamento/desprovisionamento, revisão periódica de acessos privilegiados e exigências para acessos remotos.',
  comMarkdown:
    'política de segurança da informação (psi)** robusta é o alicerce para sanar os gaps identificados',
  normal: 'Política de Segurança da Informação',
};

const ILEGAIS = /[\\/:*?"<>|]/;

describe('nome de ficheiro seguro', () => {
  it('tira os caracteres que nenhum sistema de ficheiros aceita', () => {
    for (const [nome, titulo] of Object.entries(REAIS)) {
      const seguro = nomeDeFicheiroSeguro(titulo);
      expect(ILEGAIS.test(seguro), `${nome}: «${seguro}»`).toBe(false);
    }
    // A barra do «RTO/RPO» é o caso: é português técnico correcto e mesmo
    // assim não pode entrar num nome de ficheiro.
    expect(nomeDeFicheiroSeguro('Plano RTO/RPO')).toBe('Plano RTO-RPO');
  });

  it('encurta o que a IA devolveu como briefing inteiro', () => {
    expect(REAIS.comBarraLongo.length).toBeGreaterThan(200); // o caso real
    for (const titulo of Object.values(REAIS)) {
      expect(nomeDeFicheiroSeguro(titulo).length).toBeLessThanOrEqual(MAX_NOME);
    }
  });

  it('corta na fronteira da palavra, não a meio', () => {
    const seguro = nomeDeFicheiroSeguro(REAIS.comBarraLongo);
    // Não termina a meio de uma palavra nem em pontuação solta.
    expect(seguro).not.toMatch(/[-\s.]$/);
    expect(REAIS.comBarraLongo.startsWith(seguro.split('-')[0].trim())).toBe(true);
  });

  it('deixa em paz o título que já está bem', () => {
    expect(nomeDeFicheiroSeguro(REAIS.normal)).toBe(REAIS.normal);
    expect(tituloCurto(REAIS.normal)).toBe(REAIS.normal);
  });

  it('tira as marcas de markdown que escapam do modelo', () => {
    expect(nomeDeFicheiroSeguro(REAIS.comMarkdown)).not.toContain('*');
    expect(tituloCurto(REAIS.comMarkdown)).not.toContain('*');
    expect(tituloCurto('**Política** de `Senhas`')).toBe('Política de Senhas');
  });

  it('nunca devolve vazio, nem um nome reservado do Windows', () => {
    expect(nomeDeFicheiroSeguro('')).toBe('documento');
    expect(nomeDeFicheiroSeguro(null)).toBe('documento');
    expect(nomeDeFicheiroSeguro('   ')).toBe('documento');
    expect(nomeDeFicheiroSeguro('///')).toBe('documento');
    expect(nomeDeFicheiroSeguro('CON')).toBe('CON-documento');
    expect(nomeDeFicheiroSeguro('nul')).toBe('nul-documento');
  });

  it('não deixa ponto no fim, que viraria extensão dupla', () => {
    // O título real acaba em ponto: «… cronograma de testes.»
    expect(nomeDeFicheiroSeguro('Relatório final.')).not.toMatch(/\.$/);
    expect(nomeDeFicheiroSeguro('Relatório final.')).toBe('Relatório final');
  });

  it('tituloCurto marca o corte com reticências; o nome de ficheiro não', () => {
    const curto = tituloCurto(REAIS.comBarraLongo);
    expect(curto.endsWith('…')).toBe(true);
    expect(nomeDeFicheiroSeguro(REAIS.comBarraLongo).endsWith('…')).toBe(false);
  });
});
