import { describe, it, expect } from 'vitest';
import { grupoDoDia, agruparPorDia } from '@/lib/notifications/agrupar-por-dia';

const agora = new Date(2026, 9, 16, 15, 0, 0);
const em = (dias: number, h = 10) => new Date(2026, 9, 16 - dias, h, 0, 0).toISOString();

describe('notificações agrupadas por dia', () => {
  it('hoje, ontem, esta semana e mais antigos', () => {
    expect(grupoDoDia(em(0, 1), agora)).toBe('today');
    expect(grupoDoDia(em(1, 23), agora)).toBe('yesterday');
    expect(grupoDoDia(em(6), agora)).toBe('week');
    expect(grupoDoDia(em(7), agora)).toBe('older');
  });
  it('mais recente primeiro dentro do grupo', () => {
    const g = agruparPorDia([{ created_at: em(0, 8) }, { created_at: em(0, 12) }], agora);
    expect(g.today.map((i) => i.created_at)).toEqual([em(0, 12), em(0, 8)]);
  });
});
