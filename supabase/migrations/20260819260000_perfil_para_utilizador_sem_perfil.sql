-- Todo utilizador autenticado tem de ter perfil.
--
-- Há um utilizador em `auth.users` sem linha em `profiles`, e 24 riscos
-- apontados a ele. Como a aplicação resolve o nome do responsável pela tabela
-- `profiles`, esses 24 riscos apareciam com o dono em branco, e o KPI
-- "Sem responsável" contava-os: dizia 25 de 31 numa carteira com UM risco
-- realmente sem dono. Quem olha para esse número conclui que a governança de
-- riscos não tem responsáveis atribuídos — o oposto do que está no banco.
--
-- Isto não é um caso isolado a remendar: é a falta de uma garantia. O perfil é
-- criado por gatilho em `auth.users`, e qualquer utilizador que tenha entrado
-- por um caminho que contornou o gatilho (importação, criação directa,
-- restauro de backup) fica sem ele para sempre, em silêncio.

-- ── 1. Preencher o que falta ────────────────────────────────────────────────
--
-- A empresa vem de quem já partilha registos com este utilizador; sem isso,
-- da empresa do criador dos registos. Um perfil sem `empresa_id` seria pior do
-- que nenhum: a RLS é toda por empresa.
INSERT INTO public.profiles (user_id, nome, email, empresa_id, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
       u.email,
       (SELECT r.empresa_id
          FROM public.riscos r
         WHERE r.responsavel = u.id::text
         GROUP BY r.empresa_id
         ORDER BY count(*) DESC
         LIMIT 1),
       'user'
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
   AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.responsavel = u.id::text);

-- ── 2. Impedir que volte a acontecer ────────────────────────────────────────
--
-- Um responsável tem de existir. Sem esta garantia, apagar um perfil deixa
-- registos a apontar para o vazio — exactamente o que aconteceu aqui.
CREATE OR REPLACE FUNCTION public.avisa_responsavel_sem_perfil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Só valida quando o valor É um UUID: a coluna aceita também rótulo textual
  -- ("TI", "Facilities"), que é uso legítimo e não tem perfil nenhum.
  IF NEW.responsavel IS NOT NULL
     AND NEW.responsavel ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id::text = NEW.responsavel)
  THEN
    RAISE EXCEPTION 'Responsável % não tem perfil nesta plataforma', NEW.responsavel
      USING HINT = 'Crie o perfil do utilizador antes de o atribuir como responsável.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS riscos_responsavel_com_perfil ON public.riscos;
CREATE TRIGGER riscos_responsavel_com_perfil
  BEFORE INSERT OR UPDATE OF responsavel ON public.riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.avisa_responsavel_sem_perfil();
