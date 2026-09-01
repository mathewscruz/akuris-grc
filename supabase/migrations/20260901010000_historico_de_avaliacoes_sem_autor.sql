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
-- outras 19 chaves para `profiles` fazem-no assim.
--
-- `ON DELETE SET NULL` porque o histórico é registo de auditoria: apagar
-- quem avaliou não pode apagar a avaliação.
--
-- Entram `not valid` e são validadas a seguir dentro de um bloco que apanha
-- a falha. O que o ecrã precisa é que a LIGAÇÃO exista — o PostgREST lê o
-- catálogo, não o estado de validação — e uma chave `not valid` já trava
-- tudo o que entrar de novo. Numa base com anos de uso pode haver linhas
-- que não cumprem, e uma migration que aborta a meio de um deploy é pior do
-- que uma restrição por validar: fica dito no `notice`, e valida-se depois
-- com `alter table … validate constraint …`.

alter table public.riscos_historico_avaliacoes
  drop constraint if exists riscos_historico_avaliacoes_avaliado_por_fkey;

alter table public.riscos_historico_avaliacoes
  add constraint riscos_historico_avaliacoes_avaliado_por_fkey
  foreign key (avaliado_por) references public.profiles (user_id)
  on delete set null
  not valid;

do $$
begin
  alter table public.riscos_historico_avaliacoes
    validate constraint riscos_historico_avaliacoes_avaliado_por_fkey;
exception when others then
  raise notice 'riscos_historico_avaliacoes_avaliado_por_fkey fica por validar: %', sqlerrm;
end $$;

-- `risco_id` também não tinha chave. Já há histórico a apontar para riscos
-- apagados (dois, na base local): apagar registo de auditoria não é
-- reparação, por isso a validação também é tentada e não imposta.
alter table public.riscos_historico_avaliacoes
  drop constraint if exists riscos_historico_avaliacoes_risco_id_fkey;

alter table public.riscos_historico_avaliacoes
  add constraint riscos_historico_avaliacoes_risco_id_fkey
  foreign key (risco_id) references public.riscos (id)
  on delete cascade
  not valid;

do $$
begin
  alter table public.riscos_historico_avaliacoes
    validate constraint riscos_historico_avaliacoes_risco_id_fkey;
exception when others then
  raise notice 'riscos_historico_avaliacoes_risco_id_fkey fica por validar: %', sqlerrm;
end $$;

create index if not exists idx_riscos_historico_avaliacoes_risco
  on public.riscos_historico_avaliacoes (risco_id, created_at desc);
