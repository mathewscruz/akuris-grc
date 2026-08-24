/**
 * O que se lê num CNPJ.
 *
 * A fixture não é inventada: é a resposta real da BrasilAPI para o CNPJ do
 * Banco do Brasil, com o quadro societário cortado a dois sócios. Serve para
 * que uma mudança de formato do lado da Receita parta aqui, e não em produção
 * no meio de uma diligência.
 */
import { describe, expect, it } from 'vitest';
import receitaBB from './fixtures/receita-bb.json';
import {
  alertasDoCadastro,
  cnpjValido,
  formatarCnpj,
  limparCnpj,
  montarConsulta,
  montarEndereco,
  normalizarReceita,
  normalizarSocios,
  totalDeSancoes,
} from '@/lib/cnpj';

describe('CNPJ — dígitos verificadores', () => {
  it('aceita CNPJ real, com ou sem pontuação', () => {
    expect(cnpjValido('00000000000191')).toBe(true);
    expect(cnpjValido('00.000.000/0001-91')).toBe(true);
    expect(cnpjValido('33.000.167/0001-01')).toBe(true);
  });

  it('recusa dígito trocado', () => {
    /* Um dígito errado devolveria 404 da BrasilAPI, e «não encontrado» faz a
       pessoa concluir que a empresa não existe. Melhor recusar antes. */
    expect(cnpjValido('00000000000192')).toBe(false);
    expect(cnpjValido('12345678000199')).toBe(false);
  });

  it('recusa sequência repetida, que passa na conta e não é de ninguém', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
  });

  it('recusa comprimento errado e entrada vazia', () => {
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('')).toBe(false);
  });

  it('limpa e formata', () => {
    expect(limparCnpj('00.000.000/0001-91')).toBe('00000000000191');
    expect(formatarCnpj('00000000000191')).toBe('00.000.000/0001-91');
    /* Incompleto volta como veio: formatar meio CNPJ dá um resultado que
       parece válido e não é. */
    expect(formatarCnpj('123')).toBe('123');
  });
});

describe('CNPJ — leitura do cadastro', () => {
  const cadastro = normalizarReceita(receitaBB as Record<string, unknown>);

  it('lê a resposta real da Receita', () => {
    expect(cadastro.razao_social).toBe('BANCO DO BRASIL SA');
    expect(cadastro.situacao_cadastral).toBe('ATIVA');
    expect(cadastro.abertura).toBe('1966-08-01');
    expect(cadastro.uf).toBe('DF');
    expect(cadastro.cnae_principal).toEqual({
      codigo: '6422100',
      descricao: 'Bancos múltiplos, com carteira comercial',
    });
  });

  it('não mostra «SEM MOTIVO» como se fosse motivo', () => {
    expect(cadastro.motivo_situacao).toBeNull();
  });

  it('deixa nulo o que a Receita devolve em branco', () => {
    /* `situacao_especial` vem como string vazia, não como null. Guardar '' faz
       o alerta de recuperação judicial disparar em toda a gente. */
    expect(cadastro.situacao_especial).toBeNull();
    expect(cadastro.email).toBeNull();
  });

  it('monta o endereço sem vírgulas soltas quando falta pedaço', () => {
    expect(montarEndereco({ logradouro: 'RUA X', municipio: 'PORTO', uf: 'PT' })).toBe(
      'RUA X — PORTO - PT',
    );
    expect(montarEndereco({})).toBe('');
  });

  it('guarda o sócio com o documento como a Receita o mascarou', () => {
    const socios = normalizarSocios(receitaBB.qsa);
    expect(socios).toHaveLength(2);
    expect(socios[0].nome).toBe('ALAN CARLOS GUEDES DE OLIVEIRA');
    expect(socios[0].qualificacao).toBe('Diretor');
    expect(socios[0].documento_mascarado).toBe('***550179**');
    /* Nada de reconstruir o CPF: o que chega mascarado fica mascarado. */
    expect(socios[0].documento_mascarado).toMatch(/\*/);
  });

  it('aguenta quadro societário ausente', () => {
    expect(normalizarSocios(undefined)).toEqual([]);
    expect(normalizarSocios(null)).toEqual([]);
  });
});

describe('CNPJ — alertas', () => {
  const hoje = new Date('2026-08-24T12:00:00Z');
  const base = {
    situacao_cadastral: 'ATIVA',
    situacao_especial: null,
    abertura: '2000-01-01',
    matriz_filial: 'MATRIZ',
  };
  const chaves = (a: { chave: string }[]) => a.map((x) => x.chave);

  it('empresa ativa e antiga não levanta nada', () => {
    expect(alertasDoCadastro(base, null, hoje)).toEqual([]);
  });

  it('situação diferente de ATIVA é crítica', () => {
    const a = alertasDoCadastro({ ...base, situacao_cadastral: 'BAIXADA' }, null, hoje);
    expect(chaves(a)).toContain('situacao_nao_ativa');
    expect(a[0].gravidade).toBe('critica');
  });

  it('situação especial preenchida é crítica', () => {
    const a = alertasDoCadastro(
      { ...base, situacao_especial: 'EM RECUPERACAO JUDICIAL' },
      null,
      hoje,
    );
    expect(chaves(a)).toContain('situacao_especial');
  });

  it('empresa com menos de doze meses é atenção', () => {
    expect(chaves(alertasDoCadastro({ ...base, abertura: '2026-03-10' }, null, hoje))).toContain(
      'atividade_recente',
    );
    expect(
      chaves(alertasDoCadastro({ ...base, abertura: '2025-01-10' }, null, hoje)),
    ).not.toContain('atividade_recente');
  });

  it('filial é informativa, não é problema', () => {
    const a = alertasDoCadastro({ ...base, matriz_filial: 'FILIAL' }, null, hoje);
    expect(a).toEqual([{ chave: 'e_filial', gravidade: 'informativa' }]);
  });

  it('a data de abertura não recua um dia por causa do fuso', () => {
    /*
      Doze meses exactos: no fuso de São Paulo, `new Date('2025-08-24')` cai em
      23/08 e faria a empresa parecer mais nova do que é. A conta é em UTC ao
      meio-dia justamente por isto.
    */
    expect(
      chaves(alertasDoCadastro({ ...base, abertura: '2025-08-24' }, null, hoje)),
    ).not.toContain('atividade_recente');
  });
});

describe('CNPJ — sanções', () => {
  it('sem chave configurada não é «sem sanções», é «não verificado»', () => {
    /* A distinção é o ponto todo: dizer que não há sanções sem ter procurado
       seria a pior resposta que este ecrã podia dar. */
    expect(totalDeSancoes({ verificado: false, motivo: 'sem_chave' })).toBeNull();
    expect(totalDeSancoes({ verificado: false, motivo: 'falha_consulta' })).toBeNull();
  });

  it('verificado e vazio é zero, e isso é uma resposta', () => {
    expect(totalDeSancoes({ verificado: true, ceis: [], cnep: [], leniencia: [] })).toBe(0);
  });

  it('sanção encontrada é crítica e vem antes de tudo', () => {
    const a = alertasDoCadastro(
      { situacao_cadastral: 'BAIXADA', situacao_especial: null, abertura: null, matriz_filial: null },
      { verificado: true, ceis: [{ id: 1 }], cnep: [], leniencia: [] },
      new Date('2026-08-24T12:00:00Z'),
    );
    expect(a[0]).toEqual({ chave: 'consta_em_lista_restritiva', gravidade: 'critica' });
  });

  it('não verificado não inventa alerta', () => {
    const a = alertasDoCadastro(
      { situacao_cadastral: 'ATIVA', situacao_especial: null, abertura: null, matriz_filial: null },
      { verificado: false, motivo: 'sem_chave' },
      new Date('2026-08-24T12:00:00Z'),
    );
    expect(a).toEqual([]);
  });
});

describe('CNPJ — a fotografia guardada', () => {
  it('monta a consulta inteira a partir da resposta da borda', () => {
    const consulta = montarConsulta({
      cnpj: '00000000000191',
      consultado_em: '2026-08-24T10:00:00.000Z',
      fonte: 'Receita Federal via BrasilAPI',
      receita: receitaBB as Record<string, unknown>,
      sancoes: { verificado: false, motivo: 'sem_chave' },
    });

    expect(consulta.cadastro.razao_social).toBe('BANCO DO BRASIL SA');
    expect(consulta.socios).toHaveLength(2);
    expect(consulta.alertas).toEqual([]);
    /* A data fica gravada: é ela que transforma a consulta em prova. */
    expect(consulta.consultado_em).toBe('2026-08-24T10:00:00.000Z');
    expect(consulta.sancoes.verificado).toBe(false);
  });
});
