-- A consultoria que gere o canal de várias empresas.
--
-- É o modelo de receita de quem vende só canal de denúncia: a consultoria
-- licencia N empresas e trata do canal de todas. Hoje isso é impossível — um
-- utilizador pertence a UMA empresa (`profiles.empresa_id`), e é isso que
-- `get_user_empresa_id()` devolve.
--
-- ## Porque não se mexe em `get_user_empresa_id()`
--
-- **322 políticas de RLS** dependem dessa função. Fazê-la devolver «a empresa
-- ativa» daria a consultoria multi-cliente de graça — e poria em causa, num só
-- commit, todas as fronteiras entre inquilinos do produto. Não é um risco
-- proporcional ao problema que resolve.
--
-- O que a consultoria precisa não é do produto inteiro de cada cliente: é do
-- CANAL de cada cliente. Por isso o alcance fica preso ao canal, e
-- `pode_ver_denuncia` — que já é o único portão do módulo — é o único sítio
-- que muda. As outras 321 políticas ficam como estão.

CREATE TABLE IF NOT EXISTS public.denuncias_consultoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem gere. Não muda de empresa: continua a pertencer à sua.
  user_id uuid NOT NULL,
  -- Empresa cliente cujo canal esta pessoa passa a poder tratar.
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'gestor',
  -- Quem concedeu, e quando. Uma consultoria a ver denúncias de terceiros tem
  -- de deixar rasto de quem lhe abriu a porta.
  concedido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_consultoria_unica UNIQUE (user_id, empresa_id),
  CONSTRAINT denuncias_consultoria_papel_check CHECK (papel IN ('gestor', 'leitor'))
);

CREATE INDEX IF NOT EXISTS idx_denuncias_consultoria_user
  ON public.denuncias_consultoria(user_id);

COMMENT ON TABLE public.denuncias_consultoria IS
  'Acesso de uma consultoria ao canal de denúncia de empresas clientes. O '
  'alcance é SÓ o canal: não dá riscos, contratos nem nada do resto do GRC — '
  'para isso seria preciso mexer em get_user_empresa_id(), de que dependem '
  '322 políticas.';

ALTER TABLE public.denuncias_consultoria ENABLE ROW LEVEL SECURITY;

/* Cada pessoa vê as suas próprias concessões — é como sabe que empresas gere. */
DROP POLICY IF EXISTS "Consultor ve os seus clientes" ON public.denuncias_consultoria;
CREATE POLICY "Consultor ve os seus clientes" ON public.denuncias_consultoria
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR empresa_id = public.get_user_empresa_id());

/*
  Quem concede é a EMPRESA CLIENTE, não a consultoria.

  Se a consultoria pudesse acrescentar-se a si própria, bastava uma conta
  comprometida para ler denúncias de qualquer empresa. A porta abre-se de
  dentro: um administrador do cliente é que nomeia.
*/
DROP POLICY IF EXISTS "Empresa concede acesso a consultoria" ON public.denuncias_consultoria;
CREATE POLICY "Empresa concede acesso a consultoria" ON public.denuncias_consultoria
  FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin());

DROP POLICY IF EXISTS "Require valid MFA session" ON public.denuncias_consultoria;
CREATE POLICY "Require valid MFA session" ON public.denuncias_consultoria
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_valid_mfa_session())
  WITH CHECK (public.has_valid_mfa_session());

/* As empresas cujo canal esta pessoa pode tratar — a dela mais as clientes. */
CREATE OR REPLACE FUNCTION public.empresas_do_canal()
RETURNS TABLE(empresa_id uuid, nome text, propria boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT e.id, e.nome, true
  FROM public.empresas e
  WHERE e.id = public.get_user_empresa_id()
    AND EXISTS (SELECT 1 FROM public.denuncias_comite c
                WHERE c.empresa_id = e.id AND c.user_id = auth.uid())
  UNION
  SELECT e.id, e.nome, false
  FROM public.denuncias_consultoria k
  JOIN public.empresas e ON e.id = k.empresa_id
  WHERE k.user_id = auth.uid() AND e.ativo = true;
$function$;

GRANT EXECUTE ON FUNCTION public.empresas_do_canal() TO authenticated;

/*
  O único portão do módulo passa a conhecer a consultoria.

  Repare-se no que NÃO muda: continua a exigir empresa certa, continua a
  respeitar o impedimento por conflito de interesse — que agora também se
  aplica a quem vem de fora — e continua sem dar nada além do canal.
*/
CREATE OR REPLACE FUNCTION public.pode_ver_denuncia(p_denuncia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.denuncias d
    WHERE d.id = p_denuncia_id
      AND (
        -- Gente da própria empresa: comité ou responsável designado.
        (
          d.empresa_id = public.get_user_empresa_id()
          AND (
            EXISTS (
              SELECT 1 FROM public.denuncias_comite c
              WHERE c.empresa_id = d.empresa_id AND c.user_id = auth.uid()
            )
            OR d.responsavel_id = auth.uid()
          )
        )
        -- Ou consultoria a quem esta empresa abriu o canal.
        OR EXISTS (
          SELECT 1 FROM public.denuncias_consultoria k
          WHERE k.empresa_id = d.empresa_id AND k.user_id = auth.uid()
        )
      )
      -- O impedimento ganha sempre: é o conflito de interesse.
      AND NOT EXISTS (
        SELECT 1 FROM public.denuncias_impedimentos i
        WHERE i.denuncia_id = d.id AND i.user_id = auth.uid()
      )
  );
$function$;

/*
  As políticas de `denuncias` filtravam por empresa ANTES de chegar aqui.

  `Comite ou responsavel ve denuncias` tem `empresa_id = get_user_empresa_id()`
  no próprio predicado — o que basta enquanto todos são da casa e anula a
  consultoria por completo. Passam a delegar em `pode_ver_denuncia`, que é o
  sítio onde a regra vive.
*/
DROP POLICY IF EXISTS "Comite ou responsavel ve denuncias" ON public.denuncias;
CREATE POLICY "Comite ou responsavel ve denuncias" ON public.denuncias
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(id));

DROP POLICY IF EXISTS "Comite ou responsavel altera denuncias" ON public.denuncias;
CREATE POLICY "Comite ou responsavel altera denuncias" ON public.denuncias
  FOR UPDATE TO authenticated
  USING (public.pode_ver_denuncia(id))
  WITH CHECK (public.pode_ver_denuncia(id));

DO $$
DECLARE
  v_politicas integer;
BEGIN
  /* A regra do canal tem de estar no portão, não espalhada pelas políticas. */
  SELECT count(*) INTO v_politicas
  FROM pg_policies
  WHERE tablename = 'denuncias'
    AND policyname IN ('Comite ou responsavel ve denuncias',
                       'Comite ou responsavel altera denuncias')
    AND qual ILIKE '%pode_ver_denuncia%';
  IF v_politicas <> 2 THEN
    RAISE EXCEPTION 'canal: as políticas de denuncias deixaram de usar pode_ver_denuncia';
  END IF;

  /* O alcance da consultoria não pode ter escorregado para fora do canal. */
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename NOT LIKE 'denuncias%'
      AND (qual ILIKE '%denuncias_consultoria%' OR with_check ILIKE '%denuncias_consultoria%')
  ) THEN
    RAISE EXCEPTION 'canal: a consultoria ganhou acesso fora do módulo de denúncia';
  END IF;

  RAISE NOTICE 'canal: consultoria multi-cliente, com alcance preso ao canal';
END $$;
