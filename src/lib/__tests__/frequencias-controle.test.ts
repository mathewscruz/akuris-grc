/**
 * Regra de frequência de controlo.
 *
 * Além das frequências de calendário (diária → anual), o controlo pode ser
 * «Sob demanda» ou «Automático»: acontecem quando algo ocorre, não quando o
 * relógio marca uma data. Por isso estas duas nunca podem gerar uma próxima
 * avaliação automática — a data tem de ser indicada à mão.
 */
import { describe, it, expect } from 'vitest';
import {
  proximaDataPorFrequencia,
  frequenciaSemCiclo,
} from '@/lib/controle-testes';
import { modulesPt, modulesEn } from '@/i18n/modules';

const SEM_CICLO = ['sob_demanda', 'automatico'];
const COM_CICLO = ['diaria', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual'];

describe('frequência de controlo — sob demanda e automático', () => {
  it.each(SEM_CICLO)('%s não tem ciclo de calendário', (freq) => {
    expect(frequenciaSemCiclo(freq)).toBe(true);
  });

  it.each(COM_CICLO)('%s continua com ciclo de calendário', (freq) => {
    expect(frequenciaSemCiclo(freq)).toBe(false);
  });

  it.each(SEM_CICLO)('%s não gera próxima data sozinha', (freq) => {
    expect(proximaDataPorFrequencia('2026-03-10', freq)).toBeNull();
  });

  it('mantém o cálculo das frequências de calendário', () => {
    expect(proximaDataPorFrequencia('2026-03-10', 'mensal')).toBe('2026-04-10');
    expect(proximaDataPorFrequencia('2026-03-10', 'anual')).toBe('2027-03-10');
  });

  it('as duas frequências novas têm rótulo em pt e en', () => {
    const pt = modulesPt as Record<string, Record<string, string>>;
    const en = modulesEn as Record<string, Record<string, string>>;

    expect(pt.controlesAuditorias.cdlgFrequenciaSobDemanda).toBe('Sob demanda');
    expect(pt.controlesAuditorias.cdlgFrequenciaAutomatico).toBe('Automático');
    expect(en.controlesAuditorias.cdlgFrequenciaSobDemanda).toBe('On demand');
    expect(en.controlesAuditorias.cdlgFrequenciaAutomatico).toBe('Automatic');
  });

  it('o aviso de data manual existe nos dois idiomas e cita a frequência', () => {
    const pt = (modulesPt as any).t4.testes.proximaSemCiclo as string;
    const en = (modulesEn as any).t4.testes.proximaSemCiclo as string;

    expect(pt).toContain('{{frequencia}}');
    expect(en).toContain('{{frequencia}}');
  });
});
