import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ativoDoNo, semContato } from './regras.ts';

Deno.test('máquina online vira ativo com dados de hardware', () => {
  const agora = new Date('2026-11-24T12:00:00Z');
  const a = ativoDoNo({ _id: 'node//abc', name: 'PC-01', osdesc: 'Windows 11', conn: 1 },
    { hardware: { identifiers: { cpu_name: 'i7', product_serial: 'SN1' }, windows: { memory: [{ Capacity: 8 }, { Capacity: 8 }] } }, software: [{ name: 'Chrome' }] }, agora);
  assertEquals(a.nome, 'PC-01');
  assertEquals(a.mesh_node_id, 'node//abc');
  assertEquals(a.agente_online, true);
  assertEquals(a.agente_ultimo_contato, agora.toISOString());
  assertEquals(a.atributos.numero_serie, 'SN1');
  assertEquals(a.atributos.memoria_bytes, 16);
  assertEquals(a.atributos.programas, ['Chrome']);
});

Deno.test('offline usa o último contato do agente', () => {
  const a = ativoDoNo({ _id: 'n', conn: 0, agct: Date.parse('2026-11-01T00:00:00Z') }, null);
  assertEquals(a.agente_online, false);
  assertEquals(a.agente_ultimo_contato, '2026-11-01T00:00:00.000Z');
});

Deno.test('sem contato só depois de 7 dias', () => {
  const agora = new Date('2026-11-24T00:00:00Z');
  assertEquals(semContato('2026-11-20T00:00:00Z', agora), false);
  assertEquals(semContato('2026-11-10T00:00:00Z', agora), true);
  assertEquals(semContato(null, agora), false);
});
