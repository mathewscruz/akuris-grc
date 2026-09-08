import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(path, 'utf8');

describe('evidence and user registration regressions', () => {
  it('keeps all three evidence uploads unrestricted by format, private and opaque', () => {
    for (const path of ['src/components/controles/ControleDetalheDialog.tsx',
      'src/components/controles/ControlesTestesDialog.tsx', 'src/components/auditorias/ItemAuditoriaDetalheDialog.tsx']) {
      const text = source(path);
      expect(text).not.toMatch(/accept=|allowedTypes|getPublicUrl/);
      expect(text).toContain('evidenceObjectName(file.name)');
      expect(text).toMatch(/\.upload\([^;]+EVIDENCE_UPLOAD_OPTIONS\)/);
    }
  });
  it('keeps original evidence names and the controls size limit', () => {
    expect(source('src/components/controles/ControleDetalheDialog.tsx')).toContain('file.size > 10 * 1024 * 1024');
    for (const file of ['src/components/controles/ControleDetalheDialog.tsx', 'src/components/auditorias/ItemAuditoriaDetalheDialog.tsx']) {
      expect(source(file)).toContain('arquivo_nome: file.name');
      expect(source(file)).toContain('downloadStorageFile');
    }
  });
  it('does not fall back to deleting only a profile from the browser', () => {
    const text = source('src/components/configuracoes/GerenciamentoUsuariosEnhanced.tsx');
    const deletion = text.slice(text.indexOf('const handleDelete ='), text.indexOf('const shouldShowResendButton'));
    expect(deletion).toContain("invoke('delete-user-complete'");
    expect(deletion).not.toContain('.delete()');
    expect(deletion).toContain('result.details?.auth_deleted');
    expect(text).toContain('resposta?.restored');
    expect(text).toContain('resposta?.emailSent === false');
  });
  it('requires MFA, fails closed on missing deletion targets and checks the exact removed row', () => {
    const text = source('supabase/functions/delete-user-complete/index.ts');
    expect(text).toContain('await requireValidMfa(ctx)');
    expect(text).toContain('targetError || !targetProfile || targetProfile.id !== profile_id');
    expect(text).toContain('removed?.length !== 1');
    expect(text.indexOf(".from('user_roles').delete()")).toBeGreaterThan(text.indexOf('deletedProfile = true'));
  });
  it('does not store or return password setup tokens to the administrator', () => {
    const text = source('supabase/functions/create-user/index.ts');
    expect(text).toContain('await requireValidMfa(ctx)');
    expect(text).not.toContain('invitation_link:');
    expect(text).toContain('if (setupPasswordUrl)');
    expect(text.slice(text.indexOf('return json({ success: true'))).not.toContain('setupPasswordUrl');
  });
});
