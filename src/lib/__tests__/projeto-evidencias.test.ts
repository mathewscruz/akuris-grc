import { describe, it, expect } from 'vitest';
import { semanasNoIntervalo, linkEvidenciaValido, mensagemErroTarefa, semanaAtual } from '../projeto-evidencias';

describe('semanas no Gantt', () => {
  it('começa na segunda e cobre o mês de novembro 2026 com 5 semanas', () => {
    const s = semanasNoIntervalo(new Date(2026, 10, 1).getTime(), new Date(2026, 11, 1).getTime());
    expect(new Date(s[0].ini).getDay()).toBe(1);
    expect(new Date(s[0].ini).getDate()).toBe(26); // seg 26/10
    expect(s.length).toBe(6);
    expect(s[1].num).toBe(1); // 02–08/11 é S1
  });
  it('semana atual de terça 24/11/2026 vai de 23/11 a 30/11', () => {
    const w = semanaAtual(new Date(2026, 10, 24, 10));
    expect(new Date(w.ini).getDate()).toBe(23);
    expect(new Date(w.fim).getDate()).toBe(30);
  });
});

describe('evidências', () => {
  it('aceita só links https', () => {
    expect(linkEvidenciaValido('https://drive.google.com/x')).toBe(true);
    expect(linkEvidenciaValido('http://x.com')).toBe(false);
  });
  it('traduz o bloqueio do banco ao concluir sem evidência', () => {
    expect(mensagemErroTarefa({ message: 'EVIDENCIA_OBRIGATORIA' }, 'x')).not.toContain('EVIDENCIA');
    expect(mensagemErroTarefa({ message: 'outro' }, 'x')).toBe('outro');
  });
});
