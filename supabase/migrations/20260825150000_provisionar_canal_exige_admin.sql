-- `provisionar_canal_denuncia` passa a exigir admin, e larga o acesso ao anon.
--
-- ## Porque este é diferente dos outros
--
-- Também é `SECURITY DEFINER` e recebe `p_empresa_id` sem o validar. Mas aqui
-- NÃO se pode exigir «a empresa da sessão»: a função corre no fim da criação de
-- uma empresa NOVA, para a qual quem chama ainda não pertence. Confinar à
-- empresa da sessão quebraria o único uso legítimo.
--
-- O controlo certo é sobre QUEM: criar empresa é acto de admin/super_admin
-- (é o que a política de INSERT em `empresas` já exige). Um utilizador comum
-- não tem nada que provisionar canal para empresa nenhuma — e hoje, com a
-- função aberta a qualquer autenticado, podia semear config, categorias e
-- comité em qualquer `empresa_id` que inventasse.
--
-- Sem `exige_empresa_da_sessao` isto seria mais uma escrita cross-tenant: um
-- utilizador da empresa B a criar um comité de denúncias dentro da empresa A.

CREATE OR REPLACE FUNCTION public.provisionar_canal_denuncia(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    Quem provisiona é super_admin, OU admin da PRÓPRIA empresa.

    `is_admin_or_super_admin()` sozinho não chega: verifica o papel, não a
    empresa — e um admin da empresa B provisionaria canal na empresa A na
    mesma. Provado. O caso legítimo do fluxo de criação de empresa é sempre
    super_admin (só eles criam empresa), por isso o admin comum fica preso à
    sua própria empresa e o fluxo de onboarding continua a funcionar.
  */
  IF NOT (
    public.is_super_admin()
    OR (public.is_admin_or_super_admin() AND p_empresa_id = public.get_user_empresa_id())
  ) THEN
    RAISE EXCEPTION 'acesso negado: provisionar canal exige super_admin ou o admin da própria empresa'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.denuncias_configuracoes (
    empresa_id, ativo, token_publico, permitir_anonimas, requerer_email,
    texto_apresentacao, notificar_administradores
  )
  VALUES (
    p_empresa_id, true, public.gerar_token_publico(), true, false,
    'Este canal permite comunicar, de forma segura e confidencial, situações que violem as normas internas ou a legislação aplicável.',
    true
  )
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO public.denuncias_categorias (empresa_id, nome, descricao, cor, ativo)
  SELECT p_empresa_id, v.nome, v.descricao, v.cor, true
  FROM (VALUES
    ('Assédio', 'Assédio moral ou sexual', '#EF4444'),
    ('Fraude', 'Fraude, furto ou desvio de recursos', '#F59E0B'),
    ('Corrupção', 'Suborno, corrupção ou conflito de interesses', '#8B5CF6'),
    ('Discriminação', 'Discriminação ou preconceito', '#EC4899'),
    ('Segurança', 'Segurança da informação ou do trabalho', '#3B82F6'),
    ('Outros', 'Outras situações', '#64748B')
  ) AS v(nome, descricao, cor)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.denuncias_categorias c
    WHERE c.empresa_id = p_empresa_id AND lower(c.nome) = lower(v.nome)
  );

  PERFORM public.semear_comite_denuncias(p_empresa_id);
END $function$;

/*
  Fora do alcance do anon.

  `semear_comite_denuncias` só faz sentido chamada de dentro de
  `provisionar_canal_denuncia`; deixa de estar exposta por conta própria a
  quem quer que seja autenticado. E o provisionamento inteiro sai do anon.
*/
REVOKE EXECUTE ON FUNCTION public.provisionar_canal_denuncia(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.semear_comite_denuncias(uuid) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.provisionar_canal_denuncia(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'canal: provisionamento continua ao alcance do anon';
  END IF;
  RAISE NOTICE 'canal: provisionar passa a exigir super_admin ou o admin da própria empresa';
END $$;
