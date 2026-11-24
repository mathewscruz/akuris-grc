import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { csvRow } from '../csv-utils';
import { sanitizeCampaignHtml } from '../campaign-html';
import { formLabel } from '../../../supabase/functions/scan-url-forms/labels';

const read = (path: string) => readFileSync(path, 'utf8');
describe('selected security regressions', () => {
  it('exports profile names as text and keeps commas within cells', () => {
    expect(csvRow(['=HYPERLINK("https://example.test")', 'Nome, Sobrenome'], ','))
      .toBe('"\'=HYPERLINK(""https://example.test"")","Nome, Sobrenome"');
    expect(csvRow(['User\r=1+1'], ',')).toBe('"User\r=1+1"');
  });
  it('removes stored executable campaign content but preserves email text', () => {
    const safe = sanitizeCampaignHtml('<p>Audit invitation</p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">Link</a>');
    expect(safe).toContain('<p>Audit invitation</p>');
    expect(safe).not.toMatch(/onerror|<script|javascript:/i);
  });
  it('matches select identifiers literally, including hostile regex syntax', () => {
    expect(formLabel('<label for="(a+)+">Department</label>', '(a+)+')).toBe('Department');
    expect(formLabel('<label for="aaaa">Wrong</label>', '(a+)+')).toBe('');
    expect(formLabel('<label for="[">Name</label>', '[')).toBe('Name');
  });
  it('does not backtrack on a remote regex identifier and long mismatch', () => {
    expect(formLabel(`<label for="${'a'.repeat(50000)}!">Other</label>`, '(a+)+')).toBe('');
  });
  it('checks directory administration before accessing stored credentials', () => {
    const code = read('supabase/functions/google-workspace/index.ts');
    const gate = code.indexOf("ctx.supabase.rpc('has_role'");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(code.indexOf(".from('integracoes_config')"));
    expect(code).toContain("['admin', 'super_admin']");
    expect(code).toContain('!roles.some(({ data }) => data === true)');
  });
  it('requires a global or own-company framework before reading a requirement', () => {
    const code = read('supabase/functions/gap-analysis-ai-diagnostic/index.ts');
    expect(code).toContain('gap_analysis_frameworks!inner(empresa_id)');
    expect(code).toContain('.or(`empresa_id.is.null,empresa_id.eq.${empresaId}`, { referencedTable: \'gap_analysis_frameworks\' })');
  });
  it('uses stored template names, never caller text, in supplier emails', () => {
    const code = read('supabase/functions/send-due-diligence-email/index.ts');
    expect(code).not.toContain('bodyTemplateNome');
    expect(code).toContain("let template_nome = 'Due Diligence'");
    expect(code).toContain('if (tpl?.nome) template_nome = tpl.nome');
    expect(code).toContain('empresa_id.eq.${assessment.empresa_id}');
  });
  it('prevents assignment from exposing a different company framework', () => {
    const sql = read('supabase/migrations/20261124161404_a83cfe78-92d4-4e4e-95a9-a37ca26f8699.sql');
    expect(sql).toContain('WHERE id=p_framework_id AND (empresa_id IS NULL OR empresa_id=v_empresa)');
    expect(sql.indexOf('IF v_nome IS NULL THEN RAISE EXCEPTION')).toBeLessThan(sql.indexOf('INSERT INTO public.gap_analysis_framework_owners'));
  });
  it('gates new audit risk acceptance on tenant, active account and approval authority', () => {
    const sql = read('supabase/migrations/20261124161404_a83cfe78-92d4-4e4e-95a9-a37ca26f8699.sql');
    expect(sql).toContain("BEFORE INSERT OR UPDATE OF status,auditoria_id ON public.auditoria_achados");
    expect(sql).toContain('a.empresa_id=v_empresa');
    expect(sql).toContain('p.ativo AND p.empresa_id=a.empresa_id');
    expect(sql).toContain("public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')");
    expect(sql).toContain("a.auditor_responsavel=auth.uid() AND public.usuario_tem_permissao_modulo('auditorias','update')");
    expect(sql).toContain("IF NOT v_authorized THEN RAISE EXCEPTION");
  });
});