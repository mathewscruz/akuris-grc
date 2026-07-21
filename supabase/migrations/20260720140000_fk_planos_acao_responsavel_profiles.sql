-- Adiciona FK planos_acao.responsavel_id -> profiles(user_id).
--
-- Motivo: a coluna referenciava apenas auth.users(id). Sem uma relação para
-- public.profiles, o embed do PostgREST `profiles:responsavel_id(...)` falhava
-- com PGRST200 ("Could not find a relationship"), o que derrubava a listagem
-- inteira do módulo Planos de Ação. Esta FK segue o padrão do projeto
-- (responsavel_id UUID REFERENCES public.profiles(user_id)) e habilita o embed,
-- além de garantir integridade referencial.
--
-- profiles.user_id é UNIQUE, então é um alvo de FK válido.

-- 1) Zera referências órfãs para permitir a criação da FK com segurança
--    (valores que não existem em profiles.user_id — ex.: usuários sem profile).
UPDATE public.planos_acao p
SET responsavel_id = NULL
WHERE p.responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.user_id = p.responsavel_id
  );

-- 2) Cria a FK de forma idempotente (não falha se já existir).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'planos_acao'
      AND constraint_name = 'planos_acao_responsavel_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.planos_acao
      ADD CONSTRAINT planos_acao_responsavel_id_profiles_fkey
      FOREIGN KEY (responsavel_id)
      REFERENCES public.profiles(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;
