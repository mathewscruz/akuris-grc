/**
 * A lista mostra o prazo que está a correr, não o mais distante.
 *
 * ## O que estava
 *
 * Uma denúncia tem dois relógios legais: acusar o recebimento em 7 dias e dar
 * retorno ao informante em 3 meses. A lista do comité lia só o segundo.
 *
 * Medido numa denúncia registada a 02/09/2026 pelo portal público, com
 * `prazo_acusacao = 2026-09-09` e `prazo_retorno = 2026-12-01`:
 *
 *   coluna Prazo ......... «Faltam 90 dias», a cinzento
 *   filtro «a vencer» .... não a mostrava
 *   sino (vigia nocturno)  avisaria a 07/09, a dois dias do fim
 *
 * Três leituras do mesmo caso, e a que se olha primeiro era a mais optimista.
 *
 * ## A regra, agora numa só cabeça
 *
 * `DenunciaRelogio` mostrava os dois e fechava o primeiro; `useMinhasPendencias`
 * escolhia o activo; a lista discordava. Está em `lib/prazo-da-denuncia`, e é
 * isso que este ficheiro fixa — incluindo as janelas de alerta, que têm de ser
 * as mesmas que `vigiar_prazos_denuncias` usa para tocar o sino.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  prazoActivo,
  encerrada,
  JANELA_DE_ALERTA,
  ESTADOS_ENCERRADOS,
} from '@/lib/prazo-da-denuncia';

/** O caso real, medido no portal a 02/09/2026. */
const RECEM_REGISTADA = {
  prazo_acusacao: '2026-09-09',
  prazo_retorno: '2026-12-01',
  data_acusacao_recebimento: null,
  status: 'nova',
};

describe('qual dos dois relógios conta', () => {
  it('antes de acusar, é o da acusação', () => {
    const p = prazoActivo(RECEM_REGISTADA);
    expect(p.data).toBe('2026-09-09');
    expect(p.acusacao).toBe(true);
  });

  it('depois de acusar, passa a ser o do retorno', () => {
    const p = prazoActivo({ ...RECEM_REGISTADA, data_acusacao_recebimento: '2026-09-03T10:00:00Z' });
    expect(p.data).toBe('2026-12-01');
    expect(p.acusacao).toBe(false);
  });

  it('nunca devolve o prazo distante enquanto o próximo está por cumprir', () => {
    /* O defeito em uma linha: era isto que a lista fazia. */
    expect(prazoActivo(RECEM_REGISTADA).data).not.toBe(RECEM_REGISTADA.prazo_retorno);
  });

  it('sem prazo gravado não inventa data', () => {
    expect(prazoActivo({}).data).toBeNull();
    expect(prazoActivo({ data_acusacao_recebimento: 'x' }).data).toBeNull();
  });

  it('resolvida e arquivada já não têm prazo a cumprir', () => {
    expect(encerrada({ status: 'resolvida' })).toBe(true);
    expect(encerrada({ status: 'arquivada' })).toBe(true);
    expect(encerrada({ status: 'em_investigacao' })).toBe(false);
    expect(encerrada({})).toBe(false);
  });
});

describe('a janela de alerta', () => {
  it('é mais apertada na acusação do que no retorno', () => {
    /* Sete dias e noventa na mesma régua faziam «faltam 15» significar folga
       num caso e impossibilidade no outro. */
    expect(JANELA_DE_ALERTA.acusacao).toBeLessThan(JANELA_DE_ALERTA.retorno);
  });

  it('cabe dentro do prazo que vigia', () => {
    // Uma janela de 15 dias num prazo de 7 estaria sempre aberta.
    expect(JANELA_DE_ALERTA.acusacao).toBeLessThan(7);
  });

  it('acompanha o prazo activo', () => {
    expect(prazoActivo(RECEM_REGISTADA).janela).toBe(JANELA_DE_ALERTA.acusacao);
    expect(
      prazoActivo({ ...RECEM_REGISTADA, data_acusacao_recebimento: 'x' }).janela,
    ).toBe(JANELA_DE_ALERTA.retorno);
  });

  it('é a mesma régua do sino', () => {
    /*
       O vigia nocturno é SQL e não importa daqui. Se os números divergirem, a
       lista e a notificação passam a discordar sobre o que é urgente — e é a
       notificação que acorda alguém.
    */
    const sql = readFileSync(
      'supabase/migrations/20260902010000_os_prazos_da_denuncia_nao_tinham_vigia.sql',
      'utf8',
    );
    expect(sql, 'acusacao_perto').toContain(`CURRENT_DATE + ${JANELA_DE_ALERTA.acusacao}`);
    expect(sql, 'retorno_perto').toContain(`CURRENT_DATE + ${JANELA_DE_ALERTA.retorno}`);
  });
});

describe('ninguém volta a escrever a regra à parte', () => {
  const CONSUMIDORES = [
    'src/components/denuncia/DenunciasDashboard.tsx',
    'src/hooks/useMinhasPendencias.ts',
  ];

  it('quem decide o prazo importa-o, não o recalcula', () => {
    for (const f of CONSUMIDORES) {
      const s = readFileSync(f, 'utf8');
      expect(s, `${f} não importa a regra`).toContain("from '@/lib/prazo-da-denuncia'");
      /* O ternário que existia nos dois, escrito à mão. */
      expect(
        /data_acusacao_recebimento\s*\?\s*\(?\s*d?\.?prazo_retorno/.test(s),
        `${f} voltou a escolher o prazo à mão`,
      ).toBe(false);
    }
  });

  it('a lista não volta a ler só o prazo de retorno', () => {
    const s = readFileSync('src/components/denuncia/DenunciasDashboard.tsx', 'utf8');
    expect(
      /diasAte\(\s*denuncia\.prazo_retorno\s*\)/.test(s),
      'a coluna voltou a ignorar a acusação',
    ).toBe(false);
  });

  it('os estados encerrados também vêm de um sítio só', () => {
    const s = readFileSync('src/components/denuncia/DenunciasDashboard.tsx', 'utf8');
    // Uma lista literal a mais volta a poder divergir da que a regra usa.
    expect(ESTADOS_ENCERRADOS).toEqual(['resolvida', 'arquivada']);
    expect(s).toContain('jaEncerrada');
  });
});
