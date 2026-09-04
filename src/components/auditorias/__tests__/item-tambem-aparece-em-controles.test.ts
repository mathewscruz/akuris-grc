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

const codigoMigration = readFileSync(
  'supabase/migrations/20260904132000_codigo_do_item_igual_ao_controle.sql',
  'utf8',
);

const itemForm = readFileSync(
  'src/components/auditorias/ItemAuditoriaFormDialog.tsx',
  'utf8',
);

const controleSelect = readFileSync(
  'src/components/auditorias/ControleSelect.tsx',
  'utf8',
);

const importarControles = readFileSync(
  'src/components/auditorias/ImportarControlesDialog.tsx',
  'utf8',
);

const excluirControleMigration = readFileSync(
  'supabase/migrations/20260904133000_admin_pode_excluir_controle_vinculado.sql',
  'utf8',
);

const controlesContent = readFileSync(
  'src/components/governanca/ControlesContent.tsx',
  'utf8',
);

const controleDetalhe = readFileSync(
  'src/components/controles/ControleDetalheDialog.tsx',
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

describe('código consistente entre Auditoria e Controles', () => {
  it('grava o código do item ao criar e atualizar o controle automático', () => {
    expect(codigoMigration).toMatch(
      /INSERT INTO public\.controles\s*\(\s*empresa_id,\s*codigo,[\s\S]*NULLIF\(btrim\(NEW\.codigo\), ''\)/i,
    );
    expect(codigoMigration).toMatch(
      /SET codigo = COALESCE\(NULLIF\(btrim\(NEW\.codigo\), ''\), codigo\)/i,
    );
    expect(codigoMigration).toMatch(/BEFORE INSERT OR UPDATE OF codigo,/i);
  });

  it('corrige os vínculos antigos sem trocar a identidade de controles importados', () => {
    expect(codigoMigration).toMatch(
      /UPDATE public\.controles c[\s\S]*ai\.controle_gerado_automaticamente/i,
    );
    expect(codigoMigration).toMatch(
      /UPDATE public\.auditoria_itens ai[\s\S]*SET codigo = c\.codigo/i,
    );
  });

  it('usa o código canônico ao selecionar ou importar um controle', () => {
    expect(itemForm).toContain(
      'form.setValue("codigo", shortControleId(controle.id, controle.codigo)',
    );
    expect(importarControles).toContain(
      'codigo: shortControleId(controle.id, controle.codigo)',
    );
  });
});

describe('dropdown de controles dentro do modal', () => {
  it('fica limitado à largura do campo e usa rolagem vertical compacta', () => {
    expect(controleSelect).toContain('max-h-72');
    expect(controleSelect).toContain('w-[var(--radix-select-trigger-width)]');
    expect(controleSelect).toContain('max-w-[calc(100vw-2rem)]');
    expect(controleSelect).toContain('className="truncate"');
  });
});

describe('exclusão autorizada de controle vinculado', () => {
  it('preserva o item de auditoria e desfaz apenas o vínculo', () => {
    expect(excluirControleMigration).toMatch(
      /FOREIGN KEY \(controle_vinculado_id\)[\s\S]*ON DELETE SET NULL/i,
    );
    expect(codigoMigration).toMatch(
      /TG_OP = 'UPDATE'[\s\S]*OLD\.controle_vinculado_id IS NOT NULL[\s\S]*NEW\.controle_vinculado_id IS NULL[\s\S]*RETURN NEW/i,
    );
  });

  it('exige no banco a permissão Excluir de Controles Internos', () => {
    expect(excluirControleMigration).toMatch(
      /CREATE POLICY "Permissão controles delete"[\s\S]*AS RESTRICTIVE[\s\S]*FOR DELETE/i,
    );
    expect(excluirControleMigration).toContain(
      "public.usuario_tem_permissao_modulo('controles', 'delete')",
    );
  });

  it('não oferece ações que o perfil não recebeu', () => {
    expect(controlesContent).toContain("canCreate('controles')");
    expect(controlesContent).toContain("canUpdate('controles')");
    expect(controlesContent).toContain("canDelete('controles')");
    expect(controlesContent).toMatch(/podeExcluirControle && \([\s\S]*handleDelete\(controle\.id\)/);
    expect(controleDetalhe).toMatch(/canEdit && \([\s\S]*onClick=\{onEdit\}/);
  });

  it('detecta a recusa silenciosa da RLS e mostra o motivo correto', () => {
    expect(controlesContent).toMatch(
      /exigirLinhas\([\s\S]*\.delete\(\)[\s\S]*\.eq\('id', id\)[\s\S]*\.select\('id'\)/,
    );
    expect(controlesContent).toContain('toastErrorPermission');
    expect(controlesContent).toContain('toastErrorLinked');
  });

  it('atualiza controles, indicadores e auditorias após excluir', () => {
    expect(controlesContent).toContain("queryKey: ['controles-stats']");
    expect(controlesContent).toContain("queryKey: ['controles-auditorias-vinculos']");
    expect(controlesContent).toContain("queryKey: ['auditoria-itens']");
  });
});
