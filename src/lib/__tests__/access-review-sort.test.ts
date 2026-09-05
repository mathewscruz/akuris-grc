import { expect, it } from 'vitest';
import { compareReviewRows, nextReviewSort } from '../access-review-sort';
it('sorts nested system names instead of undefined properties', () => {
  const rows = [{ sistema: { nome_sistema: 'System 10' } }, { sistema: { nome_sistema: 'System 2' } }];
  expect([...rows].sort((a,b) => compareReviewRows(a,b,{field:'sistema.nome_sistema',direction:'asc'}))[0]).toBe(rows[1]);
});
it('sorts progress by reviewed proportion, without treating an empty campaign as complete', () => {
  const rows = [{ total_contas: 0, contas_revisadas: 0 }, { total_contas: 4, contas_revisadas: 2 }, { total_contas: 10, contas_revisadas: 3 }];
  expect([...rows].sort((a,b) => compareReviewRows(a,b,{field:'progress',direction:'desc'}))).toEqual([rows[1],rows[2],rows[0]]);
});
it('keeps equality stable and cycles ascending, descending, initial order', () => {
  expect(compareReviewRows({id:'x'},{id:'x'},{field:'id',direction:'asc'})).toBe(0);
  const asc=nextReviewSort(null,'id'); expect(asc?.direction).toBe('asc');
  const desc=nextReviewSort(asc,'id'); expect(desc?.direction).toBe('desc'); expect(nextReviewSort(desc,'id')).toBeNull();
});
