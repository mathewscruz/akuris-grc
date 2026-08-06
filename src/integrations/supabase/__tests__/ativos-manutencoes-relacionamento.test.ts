import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806004000_fk_ativos_manutencoes_ativos.sql'),
  'utf8',
);

const notificationCenter = readFileSync(
  resolve(process.cwd(), 'src/components/NotificationCenter.tsx'),
  'utf8',
);

describe('ativos_manutencoes PostgREST relationship', () => {
  it('adds a non-destructive foreign key to ativos', () => {
    expect(migration).toMatch(/FOREIGN KEY\s*\(ativo_id\)/i);
    expect(migration).toMatch(/REFERENCES public\.ativos\s*\(id\)/i);
    expect(migration).toMatch(/NOT VALID/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+public\.ativos_manutencoes\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('validates only when no orphan rows exist', () => {
    expect(migration).toMatch(/orphan_count\s*=\s*0/i);
    expect(migration).toMatch(/VALIDATE CONSTRAINT ativos_manutencoes_ativo_id_ativos_fkey/i);
    expect(migration).toMatch(/RAISE NOTICE/i);
  });

  it('keeps the notification query embedding ativos', () => {
    expect(notificationCenter).toContain("ativos(nome)");
  });
});
