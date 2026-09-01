-- Três ecrãs pediam ligações que a base não tinha, e diziam «não há nada».
--
-- É o mesmo defeito da trilha de auditoria e do histórico de avaliações: o
-- PostgREST só sabe ligar duas tabelas por chave estrangeira, devolve 400
-- (PGRST200) quando não a encontra, o erro é engolido e o ecrã afirma que
-- não existem dados. Encontrados a testar os 51 `select` com `embed` do
-- produto contra a própria API: três respondem 400.
--
-- Cada chave entra `not valid` e é validada logo a seguir dentro de um bloco
-- que apanha a falha. O que os ecrãs precisam é que a LIGAÇÃO exista — o
-- PostgREST lê o catálogo, não o estado de validação — e uma chave `not
-- valid` já trava tudo o que entrar de novo. Assim a migration nunca aborta
-- por causa de linhas antigas: onde os dados estiverem limpos fica validada,
-- e onde não estiverem fica dito no `notice`.

-- 1) Histórico de versões de um documento.
--    As chaves de `created_by` e `aprovado_por` apontam a `auth.users`, que
--    o PostgREST não expõe; o ecrã pede o nome em `profiles` e nomeia essas
--    chaves na dica. Nunca podia resolver.
alter table public.documentos_historico
  drop constraint if exists documentos_historico_created_by_profiles_fkey;
alter table public.documentos_historico
  add constraint documentos_historico_created_by_profiles_fkey
  foreign key (created_by) references public.profiles (user_id)
  on delete set null
  not valid;
do $$
begin
  alter table public.documentos_historico
    validate constraint documentos_historico_created_by_profiles_fkey;
exception when others then
  raise notice 'documentos_historico_created_by_profiles_fkey fica por validar: %', sqlerrm;
end $$;

alter table public.documentos_historico
  drop constraint if exists documentos_historico_aprovado_por_profiles_fkey;
alter table public.documentos_historico
  add constraint documentos_historico_aprovado_por_profiles_fkey
  foreign key (aprovado_por) references public.profiles (user_id)
  on delete set null
  not valid;
do $$
begin
  alter table public.documentos_historico
    validate constraint documentos_historico_aprovado_por_profiles_fkey;
exception when others then
  raise notice 'documentos_historico_aprovado_por_profiles_fkey fica por validar: %', sqlerrm;
end $$;

-- 2) Avaliações do Gap Analysis por framework, no painel de indicadores.
--    `framework_id` não tinha chave nenhuma: 157 avaliações a apontar para
--    frameworks reais, e nenhuma forma de o PostgREST o saber.
alter table public.gap_analysis_evaluations
  drop constraint if exists gap_analysis_evaluations_framework_id_fkey;
alter table public.gap_analysis_evaluations
  add constraint gap_analysis_evaluations_framework_id_fkey
  foreign key (framework_id) references public.gap_analysis_frameworks (id)
  on delete cascade
  not valid;
do $$
begin
  alter table public.gap_analysis_evaluations
    validate constraint gap_analysis_evaluations_framework_id_fkey;
exception when others then
  raise notice 'gap_analysis_evaluations_framework_id_fkey fica por validar: %', sqlerrm;
end $$;

-- 3) Lembretes de convite por empresa, nas Configurações.
alter table public.user_invitation_reminders
  drop constraint if exists user_invitation_reminders_user_profiles_fkey;
alter table public.user_invitation_reminders
  add constraint user_invitation_reminders_user_profiles_fkey
  foreign key (user_id) references public.profiles (user_id)
  on delete cascade
  not valid;
do $$
begin
  alter table public.user_invitation_reminders
    validate constraint user_invitation_reminders_user_profiles_fkey;
exception when others then
  raise notice 'user_invitation_reminders_user_profiles_fkey fica por validar: %', sqlerrm;
end $$;
