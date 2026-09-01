-- A trilha de auditoria dizia que não havia histórico, com o histórico lá.
--
-- `audit_logs.user_id` só tinha chave para `auth.users`, que o PostgREST não
-- expõe. Quem pedisse `profiles(nome, email)` levava 400 (PGRST200), o erro
-- era engolido e o ecrã afirmava «Nenhum histórico de alterações encontrado».
-- Medido no R-0011: 7 registos na base, zero no ecrã; o mesmo pedido sem o
-- `embed` devolvia os 7.
--
-- A trilha partilhada (`common/TrilhaAuditoria`) já contornava isto com uma
-- segunda consulta, mas as trilhas de Riscos e de Ativos ficaram para trás e
-- continuavam mudas. Com a chave, o `embed` passa a resolver em qualquer uma.
--
-- Aponta a `profiles(user_id)`, que é único e é a convenção das outras 20
-- chaves para `profiles`. Fica `not valid`: há 2 registos, em 488 com autor,
-- de contas que já não existem em `profiles` — apagar registo de auditoria
-- não é reparação, e a restrição trava tudo o que entrar de novo.
--
-- `ON DELETE SET NULL`: apagar quem mexeu não pode apagar a prova de que
-- alguém mexeu.

alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_profiles_fkey;

alter table public.audit_logs
  add constraint audit_logs_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (user_id)
  on delete set null
  not valid;
