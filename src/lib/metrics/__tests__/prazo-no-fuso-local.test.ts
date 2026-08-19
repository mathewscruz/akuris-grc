import { describe, it, expect } from 'vitest';
import {
  isVencido,
  isAVencer,
  diasAte,
  isContratoVencido,
  isContratoAVencer,
  isDocumentoVencido,
  isPlanoAtrasado,
  isAvaliacaoVencida,
} from '@/lib/metrics';

/**
 * Prazo é lido no fuso de quem olha, não em UTC.
 *
 * `new Date('2026-08-18')` é meia-noite **UTC**. A oeste de Greenwich — que é
 * onde está o utilizador todo deste produto — isso recua para o dia anterior.
 * Como quase toda coluna de prazo é `date` puro (`data_fim` de contrato,
 * `data_vencimento` de documento, `prazo` de plano, `proxima_avaliacao` de
 * controlo), o núcleo de métricas classificava **um dia adiantado**: um
 * contrato que vence HOJE já contava como vencido, e o último dia útil para
 * agir desaparecia da tela.
 *
 * O defeito foi apanhado de lado: a trilha de auditoria, recém-ligada, acusou
 * `data_vencimento` a mudar de 2027-01-14 para 2027-01-13 num "editar" em que
 * ninguém tocou na data.
 *
 * Estes testes fixam a régua para os quatro módulos que dependem dela. A hora
 * do `ref` é deliberadamente 03:00 UTC — meia-noite em São Paulo — porque é aí
 * que o erro aparece: nesse instante o dia local e o dia UTC são diferentes.
 */

/** 18/08/2026 às 00:00 em São Paulo (UTC-3) = 03:00 UTC. */
const HOJE = new Date('2026-08-18T03:00:00Z');

const AMANHA = '2026-08-19';
const HOJE_ISO = '2026-08-18';
const ONTEM = '2026-08-17';

describe('prazo lido no fuso local', () => {
  it('o que vence hoje ainda não está vencido', () => {
    expect(isVencido(HOJE_ISO, HOJE)).toBe(false);
    expect(diasAte(HOJE_ISO, HOJE)).toBe(0);
  });

  it('o que venceu ontem está vencido', () => {
    expect(isVencido(ONTEM, HOJE)).toBe(true);
    expect(diasAte(ONTEM, HOJE)).toBe(-1);
  });

  it('o que vence amanhã está a vencer, não vencido', () => {
    expect(isVencido(AMANHA, HOJE)).toBe(false);
    expect(isAVencer(AMANHA, HOJE, 30)).toBe(true);
    expect(diasAte(AMANHA, HOJE)).toBe(1);
  });

  it('o prazo de hoje conta como a vencer — é o último dia para agir', () => {
    expect(isAVencer(HOJE_ISO, HOJE, 30)).toBe(true);
  });

  it('a régua é a mesma nos quatro módulos que dependem dela', () => {
    // Contrato ativo que termina hoje: vigente, não vencido.
    expect(isContratoVencido({ status: 'ativo', data_fim: HOJE_ISO }, HOJE)).toBe(false);
    expect(isContratoAVencer({ status: 'ativo', data_fim: HOJE_ISO }, HOJE, 30)).toBe(true);

    // Documento ativo com validade de hoje: idem.
    expect(isDocumentoVencido({ status: 'ativo', data_vencimento: HOJE_ISO }, HOJE)).toBe(false);
    expect(isDocumentoVencido({ status: 'ativo', data_vencimento: ONTEM }, HOJE)).toBe(true);

    // Plano em aberto com prazo hoje: ainda não atrasado.
    expect(isPlanoAtrasado({ status: 'em_andamento', prazo: HOJE_ISO }, HOJE)).toBe(false);
    expect(isPlanoAtrasado({ status: 'em_andamento', prazo: ONTEM }, HOJE)).toBe(true);

    // Controlo com reavaliação marcada para hoje: em dia.
    expect(isAvaliacaoVencida({ proxima_avaliacao: HOJE_ISO }, HOJE)).toBe(false);
    expect(isAvaliacaoVencida({ proxima_avaliacao: ONTEM }, HOJE)).toBe(true);
  });

  it('rascunho e arquivado não vencem — só documento ativo tem vigência', () => {
    expect(isDocumentoVencido({ status: 'rascunho', data_vencimento: ONTEM }, HOJE)).toBe(false);
    expect(isDocumentoVencido({ status: 'arquivado', data_vencimento: ONTEM }, HOJE)).toBe(false);
    expect(isDocumentoVencido({ status: 'ativo', data_vencimento: ONTEM }, HOJE)).toBe(true);
  });

  it('valor com hora (timestamptz) continua a ser lido como sempre', () => {
    // Só a data pura precisa da âncora local; quem traz hora já é inequívoco.
    expect(isVencido('2026-08-17T23:00:00Z', HOJE)).toBe(true);
    expect(isVencido(null, HOJE)).toBe(false);
    expect(diasAte(undefined, HOJE)).toBe(null);
  });
});
