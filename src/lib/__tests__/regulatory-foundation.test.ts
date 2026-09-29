import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { craCatalog, CRA_FRAMEWORK_ID, CRA_RELEASE_STATUS } from '@/lib/regulatory/catalog';
import { productDraftSchema, productVersionDraftSchema, regulatoryCatalogSchema } from '@/lib/regulatory/models';
import { calculateReadinessScore, type ReadinessResponse } from '@/lib/regulatory/readiness-score';
import { calcularScoreFramework } from '@/lib/gap-score';

describe('CRA catalog foundation', () => {
  it('keeps 22 domains, framework-independent controls and reviewed-in-context mappings', () => {
    expect(craCatalog.domains).toHaveLength(22);
    expect(craCatalog.controls).toHaveLength(22);
    expect(craCatalog.requirements).toHaveLength(22);
    expect(craCatalog.controls.find(c => c.code === 'AK-VM-001')?.descriptionEn).toContain('remediating');
    expect(craCatalog.requirements.every(r => r.mappingStrength !== 'full' && r.applicabilityRule.kind === 'human_review_required')).toBe(true);
    expect(CRA_RELEASE_STATUS).toBe('draft');
    expect(craCatalog.coverage).toContain('Not a complete');
  });
  it('matches the immutable migration seed exactly', () => {
    const sql = readFileSync('supabase/migrations/20260929145827_cra_readiness_catalog.sql', 'utf8');
    const seed = sql.match(/\$catalog\$([\s\S]*?)\$catalog\$/)?.[1];
    expect(JSON.parse(seed!)).toEqual(craCatalog);
    expect(sql).toContain(CRA_FRAMEWORK_ID);
    expect(sql).not.toMatch(/UPDATE public\.gap_analysis_evaluations/i);
  });
  it('keeps reporting dates separate from general application', () => {
    expect(craCatalog.reportingAppliesOn).toBe('2026-09-11');
    expect(craCatalog.generalAppliesOn).toBe('2027-12-11');
    const reporting = craCatalog.requirements.find(r => r.code === 'CRA-RPT-001')!;
    expect(reporting.guidanceEn).toContain('14 days of an available corrective/mitigating measure');
    expect(reporting.guidanceEn).toContain('one month of the 72-hour notification');
  });
  it('rejects orphan requirements, duplicate controls and unknown rules', () => {
    const invalid = structuredClone(craCatalog);
    invalid.requirements[0].controlCode = 'AK-NOTFOUND-001';
    expect(regulatoryCatalogSchema.safeParse(invalid).success).toBe(false);
    const duplicate = structuredClone(craCatalog);
    duplicate.controls.push(duplicate.controls[0]);
    expect(regulatoryCatalogSchema.safeParse(duplicate).success).toBe(false);
    expect(regulatoryCatalogSchema.safeParse({ ...craCatalog, requirements: [{ ...craCatalog.requirements[0], applicabilityRule: { kind: 'eval', expression: 'true' } }] }).success).toBe(false);
  });
});

describe('product and version inputs', () => {
  const product = { name: 'Product A', product_type: 'software' };
  const version = { product_id: '11111111-1111-4111-8111-111111111111', version: '1.0' };
  it('uses explicit unknown defaults and rejects tenant/creator injection into drafts', () => {
    expect(productDraftSchema.parse(product).eu_availability).toBe('unknown');
    expect(productDraftSchema.safeParse({ ...product, empresa_id: 'injected' }).success).toBe(false);
    expect(productVersionDraftSchema.safeParse({ ...version, created_by: 'injected' }).success).toBe(false);
  });
  it.each(['http://git.example/repo', 'https://token@git.example/repo', 'https://git.example/repo?token=secret', 'https://git.example/repo#secret', 'not-a-url', 'https://[', 'https://git.example:99999/repo', 'https://git.example\\repo', 'https://git.example/repo name'])('rejects unsafe repository %s', repository => {
    expect(productDraftSchema.safeParse({ ...product, repositories: [repository] }).success).toBe(false);
  });
  it('accepts a normal repository and a support period requiring legal review', () => {
    expect(productDraftSchema.safeParse({ ...product, repositories: ['https://git.example/team/product'] }).success).toBe(true);
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '2026-09-29', support_ends_on: '2028-09-29', support_rationale: 'Two-year expected lifetime; review required.' }).success).toBe(true);
  });
  it('rejects impossible dates and support ending before release', () => {
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '2026-02-30' }).success).toBe(false);
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '2026-09-29', support_ends_on: '2025-01-01' }).success).toBe(false);
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '0000-01-01' }).success).toBe(false);
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '2100-02-29' }).success).toBe(false);
    expect(productVersionDraftSchema.safeParse({ ...version, release_date: '2028-02-29' }).success).toBe(true);
  });
});

describe('separate CRA readiness method', () => {
  const response = (id: string, status: ReadinessResponse['status'], weight = 1, domain = 'security'): ReadinessResponse => ({ requirementId: id, status, weight, domain });
  it('weights assessed answers, excludes N/A and pending, and exposes coverage', () => {
    const result = calculateReadinessScore([response('1', 'conforme', 3), response('2', 'parcial', 1), response('3', 'nao_conforme', 1), response('4', 'nao_aplicavel', 10), response('5', 'nao_avaliado', 10)]);
    expect(result).toMatchObject({ score: 70, assessed: 3, pending: 1, notApplicable: 1, assessmentCoverage: 75, method: 'assessed_weighted_v1' });
  });
  it.each([{ responses: [] }, { responses: [response('1', 'nao_avaliado')] }, { responses: [response('1', 'nao_aplicavel')] }])('does not invent a score with no assessed answers', ({ responses }) => {
    expect(calculateReadinessScore(responses).score).toBeNull();
  });
  it('shows low coverage even when the only assessed answer is compliant', () => {
    expect(calculateReadinessScore([response('1', 'conforme'), response('2', 'nao_avaliado'), response('3', 'nao_avaliado'), response('4', 'nao_avaliado')])).toMatchObject({ score: 100, assessmentCoverage: 25, pending: 3 });
  });
  it('preserves the existing organizational scoring method', () => {
    const old = calcularScoreFramework([{ id: '1', peso: 1, conformityStatus: 'conforme' }, { id: '2', peso: 1, conformityStatus: 'nao_avaliado' }]);
    expect(old.score).toBe(50);
    expect(calculateReadinessScore([response('1', 'conforme'), response('2', 'nao_avaliado')]).score).toBe(100);
  });
  it('separates domain denominators and rejects duplicate or invalid responses', () => {
    expect(calculateReadinessScore([response('1', 'conforme'), response('2', 'nao_avaliado', 1, 'sbom')]).domains[1].score).toBeNull();
    expect(() => calculateReadinessScore([response('1', 'conforme'), response('1', 'parcial')])).toThrow('Duplicate');
    expect(() => calculateReadinessScore([response('1', 'conforme', 0)])).toThrow();
    expect(() => calculateReadinessScore([response('1', 'conforme', Number.NaN)])).toThrow();
  });
});
