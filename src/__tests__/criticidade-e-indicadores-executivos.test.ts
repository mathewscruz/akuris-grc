import { describe, expect, it } from 'vitest';
import { ler } from './_fontes';

const chip = ler('src/components/ui/chip.tsx');
const statusBadge = ler('src/components/ui/status-badge.tsx');
const statStrip = ler('src/components/ui/stat-strip.tsx');
const tokens = ler('src/index.css');
const controles = ler('src/components/governanca/ControlesContent.tsx');

describe('criticidade comunica intensidade, não uma inicial decorativa', () => {
  it('usa um medidor ordenado de quatro níveis', () => {
    expect(chip).toContain('SEVERITY_STEPS');
    expect(chip).toContain('critical: 4');
    expect(chip).toContain('high: 3');
    expect(chip).toContain('medium: 2');
    expect(chip).toContain('low: 1');
    expect(chip).toContain('<SeverityMeter level={tone} />');
    expect(chip).not.toContain('>{mark}</span>');
    expect(statusBadge).toContain('medidor de intensidade');
    expect(chip).toContain('data-chip-tone={tone}');
    expect(tokens).toContain('tr:has([data-chip-family="severity"][data-chip-tone="critical"])');
  });

  it('reserva o roxo para a marca e segue a escala habitual de risco', () => {
    expect(tokens).toContain('--severity-critical: 355 68% 39%');
    expect(tokens).toContain('--severity-high: 24 86% 37%');
    expect(tokens).not.toContain('--severity-critical: 272 58% 30%');
  });

  it('preenche apenas os segmentos ativos em sequência e respeita movimento reduzido', () => {
    expect(chip).toContain('data-severity-step={step}');
    expect(chip).toContain('data-active={step <= activeSteps || undefined}');
    expect(chip).toContain('--severity-step-delay');
    expect(tokens).toContain('@keyframes akuris-severity-fill');
    expect(tokens).toContain('.akuris-severity-step[data-active="true"]');
    expect(tokens).toContain('.akuris-severity-step,');
  });
});

describe('a faixa de KPIs explica os números', () => {
  it('suporta contexto, meta, direção, tendência e progresso', () => {
    for (const contract of [
      'context?: string',
      'progress?: number',
      'target?: number',
      'direction?: StatStripDirection',
      'trend?: StatStripTrend',
      'role="progressbar"',
    ]) {
      expect(statStrip).toContain(contract);
    }
  });

  it('mantém o contexto visível e sinaliza a ação de drill-down', () => {
    expect(statStrip).toContain('item.context ?? item.hint');
    expect(statStrip).toContain('group-hover:opacity-100');
    expect(statStrip).toContain('cardsKpi.metricas.tudoEmDia');
    expect(statStrip).toContain('col-span-2 sm:col-span-1');
  });

  it('conta depressa no início e desacelera até o valor final', () => {
    expect(statStrip).toContain('(now - start) / 560');
    expect(statStrip).toContain('1 - Math.pow(2, -10 * elapsed)');
    expect(statStrip).toContain('prefers-reduced-motion: reduce');
  });

  it('trata cobertura como maior-é-melhor e mostra a composição dos preventivos', () => {
    expect(controles).toContain("direction: 'higher-is-better'");
    expect(controles).toContain('target: 100');
    expect(controles).toContain("label: t('cardsKpi.metricas.preventivos')");
    expect(controles).toContain("context: t('cardsKpi.metricas.preventivosDe'");
  });
});
