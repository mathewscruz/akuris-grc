import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260904131000_item_de_auditoria_tambem_e_controle.sql',
  'utf8',
);

const itensDialog = readFileSync(
  'src/components/auditorias/ItensAuditoriaDialog.tsx',
  'utf8',
);

describe('item de auditoria visível em Controles', () => {
  it('cria um controle apenas quando o item não aponta para um existente', () => {
    expect(migration).toMatch(/IF NEW\.controle_vinculado_id IS NULL THEN[\s\S]*INSERT INTO public\.controles/i);
    expect(migration).toMatch(/NEW\.controle_vinculado_id := v_controle_id/i);
    expect(migration).toMatch(/NEW\.controle_gerado_automaticamente := true/i);
  });

  it('reutiliza código ou nome já existentes antes de criar um duplicado', () => {
    expect(migration).toMatch(/c\.codigo = btrim\(NEW\.codigo\)/i);
    expect(migration).toMatch(/lower\(btrim\(c\.nome\)\) = lower\(btrim\(NEW\.titulo\)\)/i);
    expect(migration.indexOf('SELECT c.id')).toBeLessThan(migration.indexOf('INSERT INTO public.controles'));
  });

  it('não reescreve um controle importado com os dados do papel de trabalho', () => {
    expect(migration).toMatch(/OLD\.controle_gerado_automaticamente[\s\S]*NEW\.controle_vinculado_id = OLD\.controle_vinculado_id/i);
    expect(migration).toMatch(/NEW\.controle_vinculado_id IS DISTINCT FROM OLD\.controle_vinculado_id[\s\S]*controle_gerado_automaticamente := false/i);
  });

  it('recupera os itens antigos que ficaram sem vínculo', () => {
    expect(migration).toMatch(/UPDATE public\.auditoria_itens[\s\S]*WHERE controle_vinculado_id IS NULL/i);
  });

  it('atualiza a lista e os indicadores de controles após salvar o item', () => {
    expect(itensDialog).toContain('queryKey: ["controles"]');
    expect(itensDialog).toContain('queryKey: ["controles-stats"]');
    expect(itensDialog).toContain('queryKey: ["controles-auditorias-vinculos"]');
  });
});
