/**
 * Valor de domínio nunca vai cru para o ecrã.
 *
 * `status`, `tipo`, `canal`, `criticidade` e companhia vêm da base em
 * minúsculas com sublinhado: `telefone`, `em_andamento`, `nao_conforme`. Quem
 * os escolheu foi o sistema, não o utilizador — logo, escrevem-se como o
 * produto escreve, com maiúscula inicial.
 *
 * A coluna Canal da tabela de Solicitações não tinha `render` nenhum e
 * imprimia "telefone", "portal", "email", no meio de colunas que mostram
 * "Correção", "Pendente" e "E-mail". O rótulo já existia — só o diálogo de
 * criação é que o usava.
 *
 * `formatStatus()` resolve o caso geral: procura no dicionário e, não achando,
 * troca `_` por espaço e capitaliza. Um vocabulário próprio (`rotuloCanal…`,
 * `rotuloCategoriaDados`) resolve o caso específico.
 *
 * Isto NÃO se aplica a texto escrito pelo utilizador — nome, descrição,
 * `categoria_titulares` da ROPA, `categoria` de um modelo de projeto. Esses
 * saem como foram digitados.
 */
import { describe, expect, it } from 'vitest';
import { fontes, ler } from './_fontes';
import { formatPrioridade, formatStatus } from '@/lib/text-utils';

/** Nomes de campo que carregam vocabulário controlado. */
const CAMPO_DE_DOMINIO =
  '(status|situacao|tipo|criticidade|nivel|prioridade|severidade|canal|' +
  'sensibilidade|frequencia|periodicidade|modalidade|classificacao|resultado|gravidade)';

/** `<Badge>{algo.status}</Badge>` — o valor cru dentro de um crachá. */
const CRACHA_CRU = new RegExp(
  `<(?:StatusBadge|Badge)\\b[^>]*>\\s*\\{[^}]*\\.${CAMPO_DE_DOMINIO}\\s*\\}\\s*</(?:StatusBadge|Badge)>`,
);

/** `{ label: status }` — a alternativa que devolve o slug quando falta no mapa. */
const ALTERNATIVA_CRUA = new RegExp(`\\|\\|\\s*\\{[^}]*label:\\s*${CAMPO_DE_DOMINIO}\\s*[,}]`);

/** Já passa por tradutor, ou tem alternativa. */
const TEM_TRADUTOR = /\bt\(|formatStatus|rotulo\w*\(|getEnumLabel|Label\b|\?\?|\|\|/;

describe('valor de domínio com rótulo', () => {
  it('nenhum crachá mostra o valor cru da base', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      if (!arquivo.endsWith('.tsx')) continue;
      ler(arquivo)
        .split('\n')
        .forEach((linha, i) => {
          const t = linha.trimStart();
          if (t.startsWith('//') || t.startsWith('*')) return;
          const m = CRACHA_CRU.exec(linha);
          if (m && !TEM_TRADUTOR.test(m[0])) {
            infratores.push(`${arquivo}:${i + 1} → ${linha.trim().slice(0, 90)}`);
          }
        });
    }

    expect(
      infratores,
      'Use formatStatus() ou o rótulo do vocabulário — o valor da base é minúsculo com sublinhado.',
    ).toEqual([]);
  });

  it('nenhuma alternativa de mapa devolve o slug', () => {
    const infratores: string[] = [];

    for (const arquivo of fontes()) {
      ler(arquivo)
        .split('\n')
        .forEach((linha, i) => {
          const t = linha.trimStart();
          if (t.startsWith('//') || t.startsWith('*')) return;
          if (ALTERNATIVA_CRUA.test(linha)) {
            infratores.push(`${arquivo}:${i + 1} → ${linha.trim().slice(0, 90)}`);
          }
        });
    }

    expect(
      infratores,
      'A alternativa de um mapa de rótulos é formatStatus(valor), não o valor.',
    ).toEqual([]);
  });

  it('as guardas enxergam os padrões que proíbem', () => {
    const mauCracha = '<StatusBadge tone="info">{tpl.status}</StatusBadge>';
    expect(CRACHA_CRU.test(mauCracha)).toBe(true);
    expect(TEM_TRADUTOR.test(CRACHA_CRU.exec(mauCracha)![0])).toBe(false);

    const bom = '<StatusBadge tone="info">{formatStatus(tpl.status)}</StatusBadge>';
    const mb = CRACHA_CRU.exec(bom);
    expect(mb === null || TEM_TRADUTOR.test(mb[0])).toBe(true);

    const comAlternativa = '<StatusBadge>{MAPA[p.status] ?? formatStatus(p.status)}</StatusBadge>';
    const mc = CRACHA_CRU.exec(comAlternativa);
    expect(mc === null || TEM_TRADUTOR.test(mc[0])).toBe(true);

    expect(ALTERNATIVA_CRUA.test("const c = mapa[status] || { label: status, tone: 'neutral' };")).toBe(true);
    expect(ALTERNATIVA_CRUA.test("const c = mapa[status] || { label: formatStatus(status) };")).toBe(false);
  });

  it('formatStatus capitaliza o que não conhece', () => {
    // É o que garante a regra para qualquer valor novo que apareça na base.
    expect(formatStatus('telefone')).toBe('Telefone');
    expect(formatStatus('em_andamento')).toBe('Em Andamento');
    expect(formatStatus('')).toBe('');
  });

  it('prioridade usa o gênero feminino em português', () => {
    expect(formatPrioridade('baixa')).toBe('Baixa');
    expect(formatPrioridade('media')).toBe('Média');
    expect(formatPrioridade('alta')).toBe('Alta');
    expect(formatPrioridade('critica')).toBe('Crítica');
  });
});
