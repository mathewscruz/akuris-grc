-- O histórico de avaliações de risco nunca aparecia no ecrã.
--
-- O diálogo pede `profiles:avaliado_por(nome)`, e o PostgREST só sabe ligar
-- duas tabelas por uma chave estrangeira. Não havia nenhuma em
-- `avaliado_por`, por isso o pedido devolvia 400 (PGRST200) e a aplicação
-- mostrava «Nenhum histórico de reavaliação encontrado» — uma falha de
-- leitura apresentada como facto. Medido no R-0011: o pedido com o `embed`
-- dava 400 e o mesmo pedido sem ele devolvia as duas linhas, uma delas a
-- avaliação residual que o utilizador tinha gravado.
--
-- A convenção da base é apontar para `profiles(user_id)`, que é único; as
-- outras 19 chaves para `profiles` fazem-no assim. Os 18 valores existentes
-- em `avaliado_por` correspondem todos a `profiles.user_id`.
--
-- `ON DELETE SET NULL` porque o histórico é registo de auditoria: apagar
-- quem avaliou não pode apagar a avaliação.

alter table public.riscos_historico_avaliacoes
  drop constraint if exists riscos_historico_avaliacoes_avaliado_por_fkey;

alter table public.riscos_historico_avaliacoes
  add constraint riscos_historico_avaliacoes_avaliado_por_fkey
  foreign key (avaliado_por) references public.profiles (user_id)
  on delete set null;

-- `risco_id` também não tinha chave, e já há histórico a apontar para um
-- risco apagado. Fica `not valid`: trava tudo o que entrar de novo e não
-- toca no que lá está — apagar registo de auditoria não é reparação.
alter table public.riscos_historico_avaliacoes
  drop constraint if exists riscos_historico_avaliacoes_risco_id_fkey;

alter table public.riscos_historico_avaliacoes
  add constraint riscos_historico_avaliacoes_risco_id_fkey
  foreign key (risco_id) references public.riscos (id)
  on delete cascade
  not valid;

create index if not exists idx_riscos_historico_avaliacoes_risco
  on public.riscos_historico_avaliacoes (risco_id, created_at desc);
