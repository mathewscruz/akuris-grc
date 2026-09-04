import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), `supabase/migrations/${name}`), 'utf8')
    .replace(/\s+/g, ' ');

describe('governança do ciclo de riscos', () => {
  const core = migration('20260904120000_riscos_governanca_integridade.sql');

  it('arquiva o risco sem apagar histórico e bloqueia exclusão direta pelo cliente', () => {
    expect(core).toMatch(/CREATE OR REPLACE FUNCTION public\.arquivar_risco/i);
    expect(core).toMatch(/SET arquivado_em = now\(\)/i);
    expect(core).toMatch(/DROP TRIGGER IF EXISTS trg_risco_livro_del ON public\.riscos/i);
    expect(core).toMatch(/DROP POLICY IF EXISTS "Users can delete risks from their empresa" ON public\.riscos/i);
  });

  it('versiona a matriz e mantém a versão usada no histórico', () => {
    expect(core).toMatch(/ADD COLUMN IF NOT EXISTS versao integer/i);
    expect(core).toMatch(/ADD COLUMN IF NOT EXISTS matriz_id uuid/i);
    expect(core).toMatch(/INSERT INTO public\.riscos_matrizes/i);
    expect(core).not.toMatch(/UPDATE public\.riscos_historico_avaliacoes\s+SET score/i);
  });

  it('salva tratamento e plano de ação na mesma transação lógica', () => {
    expect(core).toMatch(/CREATE OR REPLACE FUNCTION public\.salvar_tratamento_risco/i);
    expect(core).toMatch(/tratamento_risco_id/i);
    expect(core).toMatch(/RESPONSAVEL_E_PRAZO_OBRIGATORIOS/i);
  });

  it('aplica segregação de funções e aprovação administrativa acima do apetite', () => {
    const approval = migration('20260904125000_aceite_acima_apetite_exige_admin.sql');
    expect(approval).toMatch(/ACEITE_PELO_PROPRIO_SOLICITANTE/i);
    expect(approval).toMatch(/ACEITE_ACIMA_APETITE_EXIGE_ADMIN/i);
    const decisions = migration('20260904129000_decisoes_de_risco_so_pelo_aprovador.sql');
    expect(decisions).toMatch(/APENAS_APROVADOR_DESIGNADO_DECIDE/i);
    expect(decisions).toMatch(/APENAS_APROVADOR_DO_ACEITE_DECIDE/i);
    expect(decisions).toMatch(/ACEITE_FORMAL_SEM_APROVACAO/i);
  });
});

describe('monitoramento por KRI', () => {
  it('possui indicadores, medições, isolamento por empresa e agenda o próximo ciclo', () => {
    const kri = migration('20260904121000_riscos_kri_monitoramento.sql');
    const schedule = migration('20260904126000_kri_avanca_proxima_medicao.sql');
    expect(kri).toMatch(/CREATE TABLE IF NOT EXISTS public\.riscos_kris/i);
    expect(kri).toMatch(/CREATE TABLE IF NOT EXISTS public\.riscos_kri_medicoes/i);
    expect(kri).toMatch(/KRI_FORA_DA_EMPRESA/i);
    expect(kri).toMatch(/Permissão para criar medições KRI/i);
    expect(schedule).toMatch(/proxima_medicao = CASE periodicidade/i);
  });
});

describe('autoria histórica', () => {
  it('usa profiles para preservar ex-usuários sem bloquear a atualização do risco', () => {
    const authorship = migration('20260904127000_riscos_autoria_preservada_em_profiles.sql');
    expect(authorship).toMatch(/DROP CONSTRAINT IF EXISTS riscos_created_by_fkey/i);
    expect(authorship).toMatch(/REFERENCES public\.profiles\(user_id\) ON DELETE SET NULL/i);
    expect(authorship).toMatch(/DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey/i);
  });
});

describe('tratamento e plano de ação', () => {
  it('mantém os dois lados sincronizados e separa o aceite formal', () => {
    const sync = migration('20260904128000_tratamento_plano_sincronizados.sql');
    expect(sync).toMatch(/tg_tratamento_sincronizar_plano/i);
    expect(sync).toMatch(/tg_plano_sincronizar_tratamento/i);
    expect(sync).toMatch(/EXISTS \( SELECT 1 FROM public\.profiles perfil/i);
    expect(sync).toMatch(/COALESCE\(NEW\.responsavel_id::text, t\.responsavel\)/i);
    expect(sync).toMatch(/USE_FLUXO_DE_ACEITE_FORMAL/i);
  });

  it('migra tratamentos legados sem duplicar planos existentes', () => {
    const backfill = migration('20260904130000_backfill_planos_dos_tratamentos.sql');
    expect(backfill).toMatch(/REFERENCES public\.profiles\(user_id\) ON DELETE SET NULL/i);
    expect(backfill).toMatch(/WHERE quantidade = 1/i);
    expect(backfill).toMatch(/tratamentos_para_plano = 1/i);
    expect(backfill).toMatch(/SET tratamento_risco_id = u\.tratamento_id/i);
    expect(backfill).toMatch(/ON CONFLICT \(tratamento_risco_id\)/i);
  });
});
