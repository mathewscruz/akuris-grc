/*
  Fecha a lacuna dos tratamentos criados antes da integração transacional.

  Quando existe exatamente um plano antigo para exatamente um tratamento do
  mesmo risco, preservamos o plano e apenas criamos o vínculo. Nos demais
  casos, criamos um plano específico para o tratamento, sem adivinhar o
  responsável quando o legado guardou somente um nome livre.
*/
ALTER TABLE public.planos_acao
  DROP CONSTRAINT IF EXISTS planos_acao_responsavel_id_fkey;
ALTER TABLE public.planos_acao
  DROP CONSTRAINT IF EXISTS planos_acao_created_by_fkey;

-- Responsabilidade e autoria são registros organizacionais duradouros. Uma
-- conta pode sair do Auth sem apagar quem executou ou criou o plano.
ALTER TABLE public.planos_acao
  ADD CONSTRAINT planos_acao_responsavel_profiles_fkey
  FOREIGN KEY (responsavel_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.planos_acao
  ADD CONSTRAINT planos_acao_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL
  NOT VALID;

-- Converte um nome livre somente quando ele identifica um único perfil ativo
-- da mesma empresa (nome completo ou primeiro nome). Ambiguidade permanece
-- intacta para correção humana, em vez de atribuir o plano à pessoa errada.
WITH correspondencias AS (
  SELECT
    t.id AS tratamento_id,
    perfil.user_id,
    count(*) OVER (PARTITION BY t.id) AS quantidade
  FROM public.riscos_tratamentos t
  JOIN public.riscos r ON r.id = t.risco_id
  JOIN public.profiles perfil
    ON perfil.empresa_id = r.empresa_id
   AND perfil.ativo
   AND (
     lower(btrim(perfil.nome)) = lower(btrim(t.responsavel))
     OR lower(split_part(btrim(perfil.nome), ' ', 1)) = lower(btrim(t.responsavel))
   )
  WHERE COALESCE(btrim(t.responsavel), '') <> ''
    AND t.responsavel !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
), unicas AS (
  SELECT tratamento_id, user_id
  FROM correspondencias
  WHERE quantidade = 1
)
UPDATE public.riscos_tratamentos t
SET responsavel = u.user_id::text,
    updated_at = now()
FROM unicas u
WHERE t.id = u.tratamento_id;

WITH candidatos AS (
  SELECT
    t.id AS tratamento_id,
    p.id AS plano_id,
    count(*) OVER (PARTITION BY t.id) AS planos_para_tratamento,
    count(*) OVER (PARTITION BY p.id) AS tratamentos_para_plano
  FROM public.riscos_tratamentos t
  JOIN public.planos_acao p
    ON p.modulo_origem = 'riscos'
   AND p.registro_origem_id = t.risco_id
   AND p.tratamento_risco_id IS NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.planos_acao vinculado
    WHERE vinculado.tratamento_risco_id = t.id
  )
), unicos AS (
  SELECT tratamento_id, plano_id
  FROM candidatos
  WHERE planos_para_tratamento = 1
    AND tratamentos_para_plano = 1
)
UPDATE public.planos_acao p
SET tratamento_risco_id = u.tratamento_id,
    updated_at = now()
FROM unicos u
WHERE p.id = u.plano_id;

-- O tratamento é a fonte canônica no primeiro vínculo. A partir daqui, os
-- gatilhos mantêm prazo, responsável, descrição e situação sincronizados.
UPDATE public.planos_acao p
SET titulo = 'Tratar risco: ' || r.nome,
    descricao = t.descricao,
    responsavel_id = COALESCE(CASE
      WHEN t.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND EXISTS (SELECT 1 FROM public.profiles perfil WHERE perfil.user_id = t.responsavel::uuid)
      THEN t.responsavel::uuid
      ELSE NULL
    END, CASE
      WHEN EXISTS (SELECT 1 FROM public.profiles perfil WHERE perfil.user_id = p.responsavel_id)
      THEN p.responsavel_id
      ELSE NULL
    END),
    prazo = t.prazo,
    prioridade = CASE
      WHEN r.severidade_efetiva IN ('critico', 'alto') THEN 'alta'
      WHEN r.severidade_efetiva = 'medio' THEN 'media'
      ELSE 'baixa'
    END,
    status = CASE lower(translate(COALESCE(t.status, 'pendente'), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
      WHEN 'em andamento' THEN 'em_andamento'
      WHEN 'concluido' THEN 'concluido'
      WHEN 'cancelado' THEN 'cancelado'
      ELSE 'pendente'
    END,
    registro_origem_titulo = r.nome,
    -- O dump pode conter autoria de uma conta removida do Auth. O tratamento
    -- continua preservado; apenas evitamos carregar uma FK órfã no plano.
    created_by = CASE
      WHEN EXISTS (SELECT 1 FROM public.profiles perfil WHERE perfil.user_id = p.created_by)
      THEN p.created_by
      ELSE NULL
    END,
    updated_at = now()
FROM public.riscos_tratamentos t
JOIN public.riscos r ON r.id = t.risco_id
WHERE p.tratamento_risco_id = t.id;

INSERT INTO public.planos_acao (
  empresa_id,
  titulo,
  descricao,
  modulo_origem,
  registro_origem_id,
  registro_origem_titulo,
  responsavel_id,
  prazo,
  prioridade,
  status,
  created_by,
  tratamento_risco_id
)
SELECT
  r.empresa_id,
  'Tratar risco: ' || r.nome,
  t.descricao,
  'riscos',
  r.id,
  r.nome,
  CASE
    WHEN t.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND EXISTS (SELECT 1 FROM public.profiles perfil WHERE perfil.user_id = t.responsavel::uuid)
    THEN t.responsavel::uuid
    ELSE NULL
  END,
  t.prazo,
  CASE
    WHEN r.severidade_efetiva IN ('critico', 'alto') THEN 'alta'
    WHEN r.severidade_efetiva = 'medio' THEN 'media'
    ELSE 'baixa'
  END,
  CASE lower(translate(COALESCE(t.status, 'pendente'), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
    WHEN 'em andamento' THEN 'em_andamento'
    WHEN 'concluido' THEN 'concluido'
    WHEN 'cancelado' THEN 'cancelado'
    ELSE 'pendente'
  END,
  CASE WHEN EXISTS (SELECT 1 FROM public.profiles perfil WHERE perfil.user_id = r.created_by)
       THEN r.created_by ELSE NULL END,
  t.id
FROM public.riscos_tratamentos t
JOIN public.riscos r ON r.id = t.risco_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.planos_acao p
  WHERE p.tratamento_risco_id = t.id
)
ON CONFLICT (tratamento_risco_id) WHERE tratamento_risco_id IS NOT NULL
DO NOTHING;
