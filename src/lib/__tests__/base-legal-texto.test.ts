/**
 * O tradutor de base legal, testado contra os textos REAIS de um ROPA de
 * cliente — os sete que estão em produção hoje.
 *
 * Antes disto, os sete registos apareciam a vermelho ("Base fora da lei
 * aplicável") e o filtro de base legal não encontrava nenhum, porque o campo
 * guardava a frase do jurista e o produto esperava uma chave de vocabulário.
 */
import { describe, expect, it } from 'vitest';
import { chaveDaBaseLegal, extrairBasesLegais, temVariasBases } from '@/lib/base-legal-texto';

/** Os valores exactos gravados em `ropa_registros.base_legal` na base real. */
const REAIS = {
  retencao: 'Legítimo Interesse (Art. 7º, IX, LGPD).',
  cobranca: 'Execução de contrato (Art. 7º, V, LGPD) / Legítimo Interesse (Art. 7º, IX, LGPD).',
  captacao:
    'Consentimento (Art. 7º, I, LGPD) na captação via formulário; Legítimo Interesse (Art. 7º, IX) nas abordagens ativas de conversão.',
  comunicacao:
    'Execução de contrato (Art. 7º, V) para comunicações obrigatórias (boleto, notas, avisos); Legítimo Interesse (Art. 7º, IX) para comunicações de relacionamento e retenção preventiva.',
  atendimento:
    'Execução de contrato (Art. 7º, V); Legítimo Interesse (Art. 7º, IX); Cumprimento de obrigação legal (Art. 7º, II) para ouvidoria',
  discovery: 'Legítimo Interesse (Art. 7º, IX, LGPD) – melhoria de sistemas e processos internos',
  dados:
    'Derivado dos processos de tratamento originários; responsabilidade conjunta entre as marcas do Grupo Vitru.',
};

describe('base legal escrita à mão', () => {
  it('reconhece a base num texto simples', () => {
    const [b] = extrairBasesLegais(REAIS.retencao);
    expect(b.chave).toBe('legitimo_interesse');
    expect(b.citacao).toBe('Art. 7º, IX, LGPD');
  });

  it('separa duas bases divididas por barra', () => {
    const bases = extrairBasesLegais(REAIS.cobranca);
    expect(bases.map((b) => b.chave)).toEqual(['execucao_contrato', 'legitimo_interesse']);
  });

  it('separa três bases divididas por ponto e vírgula', () => {
    const bases = extrairBasesLegais(REAIS.atendimento);
    expect(bases.map((b) => b.chave)).toEqual([
      'execucao_contrato',
      'legitimo_interesse',
      'cumprimento_obrigacao',
    ]);
  });

  it('guarda o âmbito de cada base — é o que a torna auditável', () => {
    const bases = extrairBasesLegais(REAIS.comunicacao);
    expect(bases[0].chave).toBe('execucao_contrato');
    expect(bases[0].abrangencia).toContain('comunicações obrigatórias');
    expect(bases[1].chave).toBe('legitimo_interesse');
    expect(bases[1].abrangencia).toContain('relacionamento');
  });

  it('distingue consentimento de legítimo interesse no mesmo campo', () => {
    const bases = extrairBasesLegais(REAIS.captacao);
    expect(bases.map((b) => b.chave)).toEqual(['consentimento', 'legitimo_interesse']);
    expect(bases[0].abrangencia).toContain('captação via formulário');
  });

  it('não confunde "cumprimento de obrigação legal" com consentimento', () => {
    // A ordem dos sinais é o que garante isto: o mais específico ganha.
    expect(chaveDaBaseLegal('Cumprimento de obrigação legal (Art. 7º, II)')).toBe(
      'cumprimento_obrigacao',
    );
    expect(chaveDaBaseLegal('Consentimento explícito do titular')).toBe('consentimento_explicito');
    expect(chaveDaBaseLegal('Consentimento (Art. 7º, I)')).toBe('consentimento');
  });

  it('devolve o texto intacto quando não reconhece base nenhuma', () => {
    // É o sétimo registo real, e não é base legal — é uma descrição. Engolir
    // isto em silêncio seria pior do que mostrá-lo por reconhecer.
    const bases = extrairBasesLegais(REAIS.dados);
    expect(bases.every((b) => b.chave === null)).toBe(true);
    expect(bases[0].textoOriginal).toContain('Derivado dos processos');
  });

  it('lida com o travessão como separador de âmbito, não de base', () => {
    const bases = extrairBasesLegais(REAIS.discovery);
    expect(bases.filter((b) => b.chave)).toHaveLength(1);
    expect(bases[0].chave).toBe('legitimo_interesse');
    expect(bases[0].abrangencia).toContain('melhoria de sistemas');
  });

  it('não repete a mesma base duas vezes', () => {
    const bases = extrairBasesLegais('Legítimo Interesse (Art. 7º, IX); Legítimo Interesse geral');
    expect(bases.filter((b) => b.chave === 'legitimo_interesse')).toHaveLength(1);
  });

  it('campo vazio não produz base nenhuma', () => {
    expect(extrairBasesLegais('')).toEqual([]);
    expect(extrairBasesLegais(null)).toEqual([]);
    expect(extrairBasesLegais(undefined)).toEqual([]);
  });

  it('sabe dizer quando há mais do que uma base', () => {
    expect(temVariasBases(REAIS.retencao)).toBe(false);
    expect(temVariasBases(REAIS.atendimento)).toBe(true);
    expect(temVariasBases(REAIS.dados)).toBe(false);
  });

  it('os sete registos reais: quantas bases cada um produz', () => {
    // Fecha a conta: 6 dos 7 são reconhecidos, e 5 deles têm mais de uma base.
    // É a medida de por que o modelo de base única não servia.
    const contagem = Object.values(REAIS).map(
      (t) => extrairBasesLegais(t).filter((b) => b.chave).length,
    );
    expect(contagem).toEqual([1, 2, 2, 2, 3, 1, 0]);
    expect(contagem.filter((n) => n > 1)).toHaveLength(4);
  });
});
