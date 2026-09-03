import { describe, expect, it } from 'vitest';
import { ler } from './_fontes';
import { MODULE_ICON } from '@/lib/module-icons';
import { DOCGEN_TEMPLATES } from '@/lib/docgen-templates';

describe('unificação visual do Gap Analysis', () => {
  it('usa um único campo editável para mostrar e alterar o status', () => {
    const tabela = ler('src/components/gap-analysis/GenericRequirementsTable.tsx');

    expect(tabela).not.toContain('gapUi.table.colEvaluation');
    expect(tabela).not.toContain('getStatusBadge');
    expect(tabela).toContain('<SelectItem value="nao_avaliado">');
    expect(tabela.match(/field="conformity_status"/g)).toHaveLength(1);
  });

  it('repete no onboarding a identidade visual usada no catálogo', () => {
    const onboarding = ler('src/components/gap-analysis/FrameworkOnboarding.tsx');

    expect(onboarding).toContain('<FrameworkBadge');
    expect(onboarding).toContain('className="w-full space-y-6"');
    expect(onboarding).not.toContain('max-w-3xl mx-auto');
  });

  it('não mostra etiquetas de esforço nos cartões de framework', () => {
    const cartao = ler('src/components/gap-analysis/FrameworkCard.tsx');

    expect(cartao).not.toContain('getEffortLevel');
    expect(cartao).not.toContain('gapAnalysis.card.effort');
  });

  it('mantém o acesso ao AkurIA animado, respeitando redução de movimento', () => {
    const layout = ler('src/components/Layout.tsx');

    expect(layout).toContain('animate-spin-burst');
    expect(layout).toContain('motion-reduce:animate-none');
  });
});

describe('vocabulário visual dos módulos', () => {
  it('não reutiliza o mesmo ícone para módulos diferentes', () => {
    const icons = Object.values(MODULE_ICON);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('dá a cada modelo de documento um símbolo próprio', () => {
    const icons = DOCGEN_TEMPLATES.map((template) => template.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
