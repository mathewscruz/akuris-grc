import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_FEATURES } from '@/lib/ai-usage-catalog';
const source = (name: string) => readFileSync(name, 'utf8');

describe('ajustes solicitados no documento 23', () => {
  it('orientações individuais e em lote não debitam franquia e mantêm o histórico identificável', () => {
    const fn = source('supabase/functions/populate-requirement-guidance/index.ts');
    expect(fn).not.toMatch(/consume_ai_credit|temCreditoIA|semCreditoIA/);
    expect(fn).toContain("if (force || !requirementId)");
    expect(fn).toContain("has_super_admin_role");
    expect(fn).toContain("eq('ativo', true)");
    expect(AI_FEATURES.filter(f => f.edgeFunction === 'populate-requirement-guidance')).toHaveLength(2);
    expect(AI_FEATURES.filter(f => f.edgeFunction === 'populate-requirement-guidance').every(f => f.billing === 'platform')).toBe(true);
    expect(source('src/lib/atualizar-apos-escrita.ts')).toContain("f.billing !== 'platform'");
    expect(source('src/lib/edge-function-utils.ts')).toContain('isAiCall && !platformFunded');
  });
  it('evita que a tabela interna de medição alargue o diálogo inteiro', () => {
    expect(source('src/components/ui/scroll-area.tsx')).toContain('[&>div]:!block');
    expect(source('src/components/ui/tabs.tsx')).toContain('min-w-0 max-w-full space-y-4');
    expect(source('src/components/controles/ControleDetalheDialog.tsx')).toContain('size="xl"');
  });
  it('mantém busca e filtros na mesma faixa em desktop', () => {
    const s = source('src/components/due-diligence/TemplatesManager.tsx');
    expect(s).toContain('data-testid="template-toolbar"');
    expect(s).toContain('lg:flex-row lg:items-center');
    expect(s).toContain('lg:ml-auto');
  });
  it('exibe a orientação incluída nas duas superfícies e mantém navegação por seções', () => {
    for (const f of ['dialogs/RequirementDetailDialog.tsx', 'v2/RequirementDrawer.tsx']) {
      const s = source(`src/components/gap-analysis/${f}`);
      expect(s).toContain('experience.guidanceIncluded');
      expect(s).not.toContain('guidanceSemCreditos');
    }
    const dialog = source('src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx');
    expect(dialog).toContain('experience.requirementNavigation');
    expect(dialog).toContain('id="requirement-diagnosis"');
    expect(dialog).toContain('aria-pressed={answer === opt}');
    expect(dialog).not.toContain('pl-[38px]');
  });
});
