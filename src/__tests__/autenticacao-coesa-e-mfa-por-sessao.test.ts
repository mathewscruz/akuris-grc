import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('autenticação coesa e MFA vinculado à sessão', () => {
  it('vincula código, confiança, cache e RLS ao session_id do JWT', () => {
    const migration = read('supabase/migrations/20260904183000_mfa_vinculado_a_sessao.sql');
    const send = read('supabase/functions/send-mfa-code/index.ts');
    const check = read('supabase/functions/check-mfa-session/index.ts');
    const shared = read('supabase/functions/_shared/auth.ts');
    const provider = read('src/components/AuthProvider.tsx');

    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS auth_session_id text/);
    expect(migration).toMatch(/s\.auth_session_id = auth\.jwt\(\) ->> 'session_id'/);
    expect(send).toMatch(/claimsData\.claims\.session_id/);
    expect(send).toMatch(/\.eq\('auth_session_id', sessionId\)/);
    expect(check).toMatch(/\.eq\('auth_session_id', sessionId\)/);
    expect(shared).toMatch(/\.eq\('auth_session_id', ctx\.sessionId\)/);
    expect(provider).toMatch(/parsed\.sessionId !== sessionId/);
    expect(provider).toMatch(/!isMfaPending\(\) && cachedUntil/);
  });

  it('emite e consome o OTP em transações serializadas e usa HMAC', () => {
    const migration = read('supabase/migrations/20260904183000_mfa_vinculado_a_sessao.sql');
    const send = read('supabase/functions/send-mfa-code/index.ts');
    const verify = read('supabase/functions/verify-mfa-code/index.ts');

    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('verify_session_mfa_code_attempt');
    expect(send).toContain("{ name: 'HMAC', hash: 'SHA-256' }");
    expect(verify).toContain("{ name: 'HMAC', hash: 'SHA-256' }");
    expect(send).toContain("issue_session_mfa_code");
    expect(verify).toContain("verify_session_mfa_code_attempt");
  });

  it('não mantém bypass operacional que desligue MFA para utilizadores', () => {
    const shared = read('supabase/functions/_shared/auth.ts');
    expect(shared).not.toContain('MFA_ENFORCED');
  });

  it('usa uma única estrutura visual em login, recuperação, MFA e nova senha', () => {
    const auth = read('src/pages/Auth.tsx');
    const mfa = read('src/components/MFAVerification.tsx');
    const reset = read('src/pages/DefinirSenha.tsx');
    const recovery = read('src/components/auth/PasswordRecoveryPanel.tsx');

    expect(auth).toContain('<AuthShell>');
    expect(mfa).toContain('<AuthShell>');
    expect(reset).toContain('<AuthShell>');
    expect(auth).toContain('<PasswordRecoveryPanel');
    expect(recovery).toContain('sentTo');
    expect(auth).not.toContain('ForgotPasswordDialog');
  });

  it('mantém mensagens de validade alinhadas ao backend', () => {
    const pt = read('src/i18n/pt.ts');
    const mfaEmail = read('supabase/functions/send-mfa-code/_templates/mfa-code-email.tsx');
    const resetEmail = read('supabase/functions/send-password-reset/_templates/password-reset-email.tsx');

    expect(pt).toContain('Código válido por 5 minutos');
    expect(pt).toContain('cada link é válido por 1 hora');
    expect(mfaEmail).toContain('<strong>5 minutos</strong>');
    expect(resetEmail).toContain('<strong>1 hora</strong>');
  });

  it('não aceita sessão comum na rota de recuperação e revoga sessões ao concluir', () => {
    const reset = read('src/pages/DefinirSenha.tsx');
    expect(reset).toMatch(/value === 'recovery' \|\| value === 'invite'/);
    expect(reset).not.toMatch(/getSession\(\)[\s\S]{0,200}setIsTokenValid\(true\)/);
    expect(reset).toContain("rpc('revoke_my_mfa_sessions')");
    expect(reset).toContain("signOut({ scope: 'global' })");
  });

  it('desativa cadastro público e protege os controlos de senha para teclado e password managers', () => {
    const config = read('supabase/config.toml');
    const auth = read('src/pages/Auth.tsx');
    const reset = read('src/pages/DefinirSenha.tsx');

    expect(config.match(/enable_signup = false/g)?.length).toBe(2);
    expect(config).toContain('enable_confirmations = true');
    expect(auth).not.toContain('tabIndex={-1}');
    expect(auth).toContain('autoComplete="username"');
    expect(reset.match(/autoComplete="new-password"/g)?.length).toBe(2);
    expect(reset).toContain("t('auth.showPassword')");
  });

  it('gera recuperação por URL de ambiente e não aceita logo vindo do pedido público', () => {
    const recovery = read('supabase/functions/send-password-reset/index.ts');
    expect(recovery).toMatch(/Deno\.env\.get\('APP_URL'\).*Deno\.env\.get\('SITE_URL'\)/);
    const requestShape = /interface PasswordResetRequest\s*\{([^}]*)\}/.exec(recovery)?.[1] ?? '';
    expect(requestShape).not.toContain('companyLogoUrl');
    expect(recovery).toContain('const company = Array.isArray(profile.empresa)');
    expect(recovery).toContain('companyLogoUrl: company?.logo_url');
  });

  it('permite encerrar outras sessões sem derrubar o dispositivo atual', () => {
    const migration = read('supabase/migrations/20260904183000_mfa_vinculado_a_sessao.sql');
    const profile = read('src/components/UserProfilePopover.tsx');

    expect(migration).toContain('revoke_other_mfa_sessions');
    expect(migration).toContain('auth_session_id IS DISTINCT FROM v_session_id');
    expect(profile).toContain("signOut({ scope: 'others' })");
    expect(profile).toContain("rpc('revoke_other_mfa_sessions')");
  });
});
