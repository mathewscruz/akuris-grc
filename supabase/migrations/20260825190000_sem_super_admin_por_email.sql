-- Registar-se com um e-mail não pode dar-te a plataforma inteira.
--
-- ## O que estava aberto
--
-- O gatilho `handle_new_user` — que corre a cada registo — atribuía o papel
-- assim:
--
--     CASE WHEN NEW.email = 'admin@governaii.com' THEN 'super_admin' ...
--
-- Um e-mail cravado no código a valer `super_admin`. E `super_admin` no Akuris
-- não é administrador de uma empresa: é acesso a TODOS os inquilinos.
--
-- A cadeia estava completa e viva em produção:
--
--   1. `disable_signup: false` — o registo está aberto a qualquer pessoa;
--   2. `mailer_autoconfirm: true` — a conta confirma-se sozinha, ou seja, quem
--      se regista NÃO precisa de possuir a caixa de correio;
--   3. a conta `admin@governaii.com` NÃO existia — o endereço estava livre;
--   4. o gatilho promovia-a a `super_admin` no acto.
--
-- Bastava um pedido de registo, de qualquer pessoa na internet, para ficar com
-- acesso de plataforma sobre os dados de todos os clientes. Sem explorar bug
-- nenhum: era o comportamento programado.
--
-- ## A correcção
--
-- Ninguém nasce `super_admin`. O papel passa a ser sempre `user`, e a promoção
-- faz-se deliberadamente, por quem já tem poder para isso — que é como os
-- outros papéis do produto já funcionam.
--
-- Preserva-se todo o resto do gatilho tal e qual: o desvio para criação
-- administrativa (`admin_created`), o nome derivado do e-mail, e o tratamento
-- de erros que nunca deixa o registo falhar por causa do perfil.
--
-- Os `super_admin` que já existem não são tocados — esta mudança só governa
-- quem se regista de agora em diante.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Não criar perfil automaticamente se for criação administrativa
  IF NEW.raw_user_meta_data ->> 'admin_created' = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    -- Sempre o papel mais fraco. Promover é um acto deliberado de quem já tem
    -- poder para o fazer, nunca uma consequência do endereço de e-mail.
    'user'::public.user_role
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error and continue with user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $function$;

DO $$
DECLARE
  v_promovidos integer;
BEGIN
  -- Se alguém já se aproveitou disto antes da correcção, tem de aparecer aqui.
  SELECT count(*) INTO v_promovidos
  FROM public.profiles
  WHERE role = 'super_admin' AND email = 'admin@governaii.com';

  IF v_promovidos > 0 THEN
    RAISE WARNING 'ATENÇÃO: existem % conta(s) super_admin com o e-mail que estava cravado — investigar', v_promovidos;
  ELSE
    RAISE NOTICE 'handle_new_user: ninguém foi promovido pelo e-mail cravado; porta fechada';
  END IF;
END $$;
