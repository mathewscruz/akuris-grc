import { describe, expect, it } from 'vitest';
import { ler } from './_fontes';

const banner = ler('src/components/ui/module-banner.tsx');
const privacidade = ler('src/components/dados/CentroPrivacidadeTab.tsx');
const gap = ler('src/components/gap-analysis/WelcomeHero.tsx');
const jornada = ler('src/components/gap-analysis/v2/FrameworkJourneyNextAction.tsx');
const continuidade = ler('src/components/continuidade/PreparacaoContinuidade.tsx');
const sistemas = ler('src/components/governanca/SistemasContent.tsx');
const paginaSistemas = ler('src/pages/Sistemas.tsx');
const dueDiligence = ler('src/components/due-diligence/DueDiligenceDashboard.tsx');

describe('faixas editoriais dos módulos', () => {
  it('usa uma marca-d’água temática compartilhada e fora da árvore acessível', () => {
    expect(banner).toContain('akuris-module-banner');
    expect(banner).toContain('aria-hidden="true"');
    expect(banner).toContain('text-primary/[0.055]');
    expect(privacidade).toContain('icon={PrivacidadeIcon}');
    expect(gap).toContain('icon={GapAnalysisIcon}');
    expect(jornada).toContain('icon={CurrentIcon}');
    expect(continuidade).toContain('icon={ContinuidadeIcon}');
  });
});

describe('consistência das páginas operacionais', () => {
  it('mantém a ação de Sistemas no cabeçalho e a tabela sem título duplicado', () => {
    expect(paginaSistemas).toContain('actions={<div ref={setActionsSlot}');
    expect(paginaSistemas).toContain('<SistemasContent actionsSlot={actionsSlot} />');
    expect(sistemas).toContain('actionsSlot && createPortal(');
    expect(sistemas).not.toContain('p-6 pb-4 flex flex-col');
  });

  it('mostra avaliações que exigem atenção como lista compacta, sem cartões aninhados', () => {
    expect(dueDiligence).toContain('divide-y divide-border/70');
    expect(dueDiligence).toContain('bg-warning/[0.045]');
    expect(dueDiligence).toContain('stats.recentAssessments.length');
    expect(dueDiligence).not.toContain('rounded-lg border p-3 sm:flex-row');
  });
});
