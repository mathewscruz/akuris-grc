import { describe, it, expect } from 'vitest';
import {
  contarRiscosPorSeveridade, isRiscoCritico, isRiscoAlto, isRiscoMedio, isRiscoBaixo,
  contarIncidentes, isIncidenteEmInvestigacao, isIncidenteAberto, isIncidenteResolvido,
  contarContratos, isContratoVigente, isContratoVencido, isContratoAVencer, estadoContrato,
  contarAtivos, estadoAtivo, criticidadeAtivo,
  contarControles, isControleAtivo, isAvaliacaoVencida, efetividadeControles, proporcaoPreventivos,
  contarPlanos, isPlanoAberto, isPlanoAtrasado,
  contarDocumentos, isDocumentoAtivo, isDocumentoVencido,
  contarRequisitos, isRequisitoConforme, isRequisitoNaoConforme, isRequisitoAplicavel,
} from '@/lib/metrics';

/**
 * Garantia anti-regressão: o número do cartão KPI tem de ser exatamente o
 * mesmo que resulta de filtrar a lista com o predicado que pinta a tabela.
 * Se alguém voltar a calcular uma contagem dentro de uma página, estes
 * testes deixam de bater certo.
 */

const HOJE = new Date('2026-08-14T12:00:00Z');

describe('paridade cartão × tabela — Riscos', () => {
  const riscos = [
    { nivel_risco_inicial: 'Crítico' },
    { nivel_risco_inicial: 'critico' },
    { nivel_risco_inicial: 'Alto' },
    { nivel_risco_inicial: 'Médio' },
    { nivel_risco_inicial: 'medio' },
    { nivel_risco_inicial: 'Baixo' },
    { nivel_risco_inicial: null },
  ];
  const c = contarRiscosPorSeveridade(riscos);

  it('conta cada severidade como a tabela', () => {
    expect(c.criticos).toBe(riscos.filter(r => isRiscoCritico(r)).length);
    expect(c.altos).toBe(riscos.filter(r => isRiscoAlto(r)).length);
    expect(c.medios).toBe(riscos.filter(r => isRiscoMedio(r)).length);
    expect(c.baixos).toBe(riscos.filter(r => isRiscoBaixo(r)).length);
    expect(c.total).toBe(riscos.length);
  });

  it('normaliza acentos e maiúsculas', () => {
    expect(c.criticos).toBe(2);
    expect(c.medios).toBe(2);
  });
});

describe('paridade cartão × tabela — Incidentes', () => {
  const incidentes = [
    { status: 'aberto', criticidade: 'critica' },
    { status: 'em_investigacao', criticidade: 'alta' },
    { status: 'Em Investigação', criticidade: 'media' },
    { status: 'investigacao', criticidade: 'baixa' },
    { status: 'resolvido', criticidade: 'media' },
  ];
  const c = contarIncidentes(incidentes);

  it('em investigação nunca fica a zero com linhas em investigação', () => {
    expect(c.investigacao).toBe(incidentes.filter(isIncidenteEmInvestigacao).length);
    expect(c.investigacao).toBe(3);
  });

  it('abertos e resolvidos batem com o predicado da lista', () => {
    expect(c.abertos).toBe(incidentes.filter(isIncidenteAberto).length);
    expect(c.resolvidos).toBe(incidentes.filter(isIncidenteResolvido).length);
  });
});

describe('paridade cartão × tabela — Contratos', () => {
  const contratos = [
    { status: 'ativo', data_fim: '2026-07-30', valor: 500_000 }, // vencido apesar de "ativo"
    { status: 'ativo', data_fim: '2026-08-20', valor: 100_000 }, // a vencer
    { status: 'ativo', data_fim: '2027-01-01', valor: 96_000 },
    { status: 'encerrado', data_fim: '2025-01-01', valor: 999 },
  ];
  const c = contarContratos(contratos, HOJE);

  it('o estado deriva da data, não do campo estático', () => {
    expect(estadoContrato(contratos[0], HOJE)).toBe('vencido');
    expect(c.vencidos).toBe(contratos.filter(x => isContratoVencido(x, HOJE)).length);
    expect(c.vencendo30Dias).toBe(contratos.filter(x => isContratoAVencer(x, HOJE)).length);
  });

  it('o valor em contratos ativos exclui os vencidos', () => {
    const esperado = contratos
      .filter(x => isContratoVigente(x, HOJE))
      .reduce((s, x) => s + x.valor, 0);
    expect(c.valorTotal).toBe(esperado);
    expect(c.valorTotal).not.toContain?.(500_000);
    expect(c.valorVencido).toBe(500_000);
  });
});

describe('paridade cartão × tabela — Ativos', () => {
  const ativos = [
    { status: 'ativo', criticidade: 'crítico', valor_negocio: 'alto' },
    { status: 'Inativo', criticidade: 'alto', valor_negocio: 'medio' },
    { status: 'descontinuado', criticidade: 'baixo', valor_negocio: 'baixo' },
  ];
  const c = contarAtivos(ativos);

  it('estados e criticidades batem com a lista', () => {
    expect(c.ativos).toBe(ativos.filter(a => estadoAtivo(a) === 'ativo').length);
    expect(c.inativos).toBe(ativos.filter(a => estadoAtivo(a) === 'inativo').length);
    expect(c.criticos).toBe(ativos.filter(a => criticidadeAtivo(a) === 'critico').length);
  });
});

describe('paridade cartão × tabela — Controles', () => {
  const controles = [
    { id: '1', status: 'ativo', tipo: 'preventivo', data_proxima_avaliacao: '2026-07-01' },
    { id: '2', status: 'ativo', tipo: 'preventivo' },
    { id: '3', status: 'ativo', tipo: 'detectivo' },
    { id: '4', status: 'inativo', tipo: 'corretivo' },
  ];
  const c = contarControles(controles);

  it('contagens iguais às da tabela', () => {
    expect(c.ativos).toBe(controles.filter(isControleAtivo).length);
    expect(c.vencidos).toBe(controles.filter(x => isAvaliacaoVencida(x, HOJE)).length);
  });

  it('sem testes registados a efetividade é nula, nunca 0% nem proporção de preventivos', () => {
    const e = efetividadeControles(controles, []);
    expect(e.percentual).toBeNull();
    expect(e.controlesTestados).toBe(0);
    expect(proporcaoPreventivos(controles).percentual).toBe(50);
  });

  it('com testes registados a efetividade passa a existir', () => {
    const e = efetividadeControles(controles, [
      { controle_id: '1', resultado: 'eficaz', data_teste: '2026-08-01' },
      { controle_id: '2', resultado: 'ineficaz', data_teste: '2026-08-01' },
    ]);
    expect(e.controlesTestados).toBe(2);
    expect(e.percentual).not.toBeNull();
  });
});

describe('paridade cartão × tabela — Planos de Ação', () => {
  const planos = [
    { status: 'pendente', prazo: '2026-07-01' },
    { status: 'em_andamento', prazo: '2026-12-01' },
    { status: 'concluido', prazo: '2026-01-01' },
  ];
  const c = contarPlanos(planos, HOJE);

  it('pendentes e atrasados batem com a lista', () => {
    expect(c.pendentes).toBe(planos.filter(isPlanoAberto).length);
    expect(c.atrasados).toBe(planos.filter(p => isPlanoAtrasado(p, HOJE)).length);
  });
});

describe('paridade cartão × tabela — Documentos', () => {
  const documentos = [
    { status: 'ativo', data_validade: '2026-12-01' },
    { status: 'Ativo', data_validade: '2026-01-01' },
    { status: 'em_aprovacao' },
  ];
  const c = contarDocumentos(documentos, HOJE);

  it('ativos e vencidos batem com a lista', () => {
    expect(c.ativos).toBe(documentos.filter(isDocumentoAtivo).length);
    expect(c.vencidos).toBe(documentos.filter(d => isDocumentoVencido(d, HOJE)).length);
  });
});

describe('paridade cartão × tabela — Gap Analysis', () => {
  const avaliacoes = [
    { status: 'conforme' },
    { status: 'parcial' },
    { status: 'nao_conforme' },
    { status: 'nao_aplicavel' },
  ];
  const c = contarRequisitos(avaliacoes);

  it('conformes, não conformes e aplicáveis batem com a lista', () => {
    expect(c.conformes).toBe(avaliacoes.filter(isRequisitoConforme).length);
    expect(c.naoConformes).toBe(avaliacoes.filter(isRequisitoNaoConforme).length);
    expect(c.aplicaveis).toBe(avaliacoes.filter(isRequisitoAplicavel).length);
  });

  it('não aplicável fica fora do denominador', () => {
    expect(c.aplicaveis).toBe(3);
  });
});
