import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260904220000_rls_nao_eleva_privilegio.sql',
  'utf8',
);

describe('RLS não promove privilégios de plataforma', () => {
  it('reserva a criação de empresas ao super admin', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Admins can insert empresas"');
    expect(migration).toMatch(
      /CREATE POLICY "Only super admins can insert empresas"[\s\S]*WITH CHECK \(public\.is_super_admin\(\)\)/,
    );
  });

  it('remove as políticas que permitiam promover framework local a template', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can insert frameworks in their empresa"',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can update frameworks for their company"',
    );
    expect(migration).toContain('is_template=false');
  });
});
