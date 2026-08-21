-- Canal de Denúncia, onda 1: o que impede vender.
--
-- Três defeitos, todos verificados no produto antes desta migration:
--
--  1. **A evidência anexada nunca chegava.** O formulário público enviava para
--     o bucket `denuncias-anexos`, que não existe; o erro era só registado no
--     log e a tela de sucesso aparecia à mesma; e o formulário nunca gravava
--     linha em `denuncias_anexos`, portanto a aba do gestor estava
--     permanentemente vazia. Num canal de denúncia a evidência é o caso.
--
--  2. **Não havia marca branca.** O denunciante via o logótipo da Akuris, não
--     o da empresa que vai denunciar. A configuração tinha oito colunas e
--     nenhuma era logótipo, cor ou idioma.
--
--  3. **Todo administrador lia todas as denúncias** — por ecrã e por e-mail.
--     Se a denúncia era SOBRE um administrador, esse administrador lia-a antes
--     de qualquer triagem. A ISO 37002 e a Diretiva (UE) 2019/1937 exigem
--     tratamento por pessoas designadas e imparciais.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. O bucket da evidência
-- ─────────────────────────────────────────────────────────────────────────
/*
  Privado, com tecto de 10 MB por ficheiro — o mesmo que o formulário promete.

  Ninguém escreve aqui com a chave pública: quem envia a denúncia é anónimo, e
  abrir `INSERT` ao papel `anon` seria um balde de upload aberto à internet. A
  escrita passa pela função de borda, que valida e assina; o `service_role`
  ignora RLS, portanto não há política de escrita nenhuma — a ausência é
  deliberada.
*/
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'denuncias-anexos',
  'denuncias-anexos',
  false,
  10485760,
  ARRAY[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
    'audio/webm','audio/mpeg','audio/ogg','audio/wav',
    'video/mp4','video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Marca branca
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.denuncias_configuracoes
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_destaque text,
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS idioma_padrao text NOT NULL DEFAULT 'pt';

COMMENT ON COLUMN public.denuncias_configuracoes.logo_url IS
  'Logótipo da EMPRESA no canal público e no e-mail de aviso. Nulo cai no nome '
  'da empresa em texto — nunca no logótipo da Akuris: quem denuncia tem de ver '
  'a marca de quem vai denunciar.';
COMMENT ON COLUMN public.denuncias_configuracoes.cor_destaque IS
  'Cor de destaque do canal público, em hex. Nula usa o roxo da plataforma.';
COMMENT ON COLUMN public.denuncias_configuracoes.idioma_padrao IS
  'Idioma com que o canal público abre: pt | en | es.';

ALTER TABLE public.denuncias_configuracoes
  DROP CONSTRAINT IF EXISTS denuncias_config_idioma_check;
ALTER TABLE public.denuncias_configuracoes
  ADD CONSTRAINT denuncias_config_idioma_check
  CHECK (idioma_padrao IN ('pt','en','es'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Comité de ética e impedimentos
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.denuncias_comite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  /* `gestor` triage e designa; `investigador` só vê o que lhe for atribuído. */
  papel text NOT NULL DEFAULT 'gestor',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_comite_papel_check CHECK (papel IN ('gestor','investigador')),
  CONSTRAINT denuncias_comite_unico UNIQUE (empresa_id, user_id)
);

COMMENT ON TABLE public.denuncias_comite IS
  'Quem pode ver denúncias nesta empresa. Substitui o `is_admin()` que dava '
  'acesso a toda a administração — num canal de denúncia isso inverte a '
  'finalidade do canal.';

CREATE TABLE IF NOT EXISTS public.denuncias_impedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_impedimento_unico UNIQUE (denuncia_id, user_id)
);

COMMENT ON TABLE public.denuncias_impedimentos IS
  'Conflito de interesse: quem NÃO pode ver esta denúncia em concreto, mesmo '
  'sendo do comité. Tipicamente a pessoa citada nela.';

CREATE INDEX IF NOT EXISTS idx_denuncias_comite_empresa ON public.denuncias_comite(empresa_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_impedimentos_denuncia ON public.denuncias_impedimentos(denuncia_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Semear o comité com quem já tinha acesso
-- ─────────────────────────────────────────────────────────────────────────
/*
  Sem isto, a mudança de RLS TIRAVA a denúncia de toda a gente no instante em
  que corresse: não haveria comité nenhum e nem os administradores actuais
  veriam o que já viam. Semeia-se com quem tem acesso hoje, para que a
  estrutura entre sem cortar ninguém — a partir daí o cliente reduz o comité
  ao que deve ser, que é uma decisão dele e não desta migration.
*/
-- Quem era administrador.
INSERT INTO public.denuncias_comite (empresa_id, user_id, papel)
SELECT p.empresa_id, p.user_id, 'gestor'
FROM public.profiles p
WHERE p.empresa_id IS NOT NULL
  AND p.role IN ('admin','super_admin')
ON CONFLICT (empresa_id, user_id) DO NOTHING;

-- E quem já era responsável por alguma denúncia, mesmo sem ser administrador:
-- a regra antiga dava-lhe acesso, e esta migration não pode tirá-lo.
INSERT INTO public.denuncias_comite (empresa_id, user_id, papel)
SELECT DISTINCT d.empresa_id, d.responsavel_id, 'investigador'
FROM public.denuncias d
WHERE d.responsavel_id IS NOT NULL
ON CONFLICT (empresa_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Quem pode ver uma denúncia
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pode_ver_denuncia(p_denuncia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.denuncias d
    WHERE d.id = p_denuncia_id
      AND d.empresa_id = public.get_user_empresa_id()
      -- Estar no comité da empresa, ou ser o responsável designado.
      AND (
        EXISTS (
          SELECT 1 FROM public.denuncias_comite c
          WHERE c.empresa_id = d.empresa_id AND c.user_id = auth.uid()
        )
        OR d.responsavel_id = auth.uid()
      )
      -- O impedimento ganha sempre: é o conflito de interesse.
      AND NOT EXISTS (
        SELECT 1 FROM public.denuncias_impedimentos i
        WHERE i.denuncia_id = d.id AND i.user_id = auth.uid()
      )
  );
$$;

COMMENT ON FUNCTION public.pode_ver_denuncia(uuid) IS
  'Fonte única de "quem pode ler esta denúncia". Usada pelas políticas de '
  'denuncias, movimentações, anexos, mensagens e do bucket de evidência — '
  'para que não voltem a divergir.';

/** Está no comité desta empresa? Para listas e triagem, sem denúncia à mão. */
CREATE OR REPLACE FUNCTION public.e_do_comite_denuncias()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.denuncias_comite c
    WHERE c.empresa_id = public.get_user_empresa_id() AND c.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. As políticas passam a usá-la
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins/responsavel can view denuncias" ON public.denuncias;
DROP POLICY IF EXISTS "Comite ou responsavel ve denuncias" ON public.denuncias;
CREATE POLICY "Comite ou responsavel ve denuncias" ON public.denuncias
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(id));

DROP POLICY IF EXISTS "Admins or responsavel can update denuncias" ON public.denuncias;
DROP POLICY IF EXISTS "Comite ou responsavel altera denuncias" ON public.denuncias;
CREATE POLICY "Comite ou responsavel altera denuncias" ON public.denuncias
  FOR UPDATE TO authenticated
  USING (public.pode_ver_denuncia(id))
  WITH CHECK (public.pode_ver_denuncia(id));

DROP POLICY IF EXISTS "Admins or responsavel can view denuncia movimentacoes" ON public.denuncias_movimentacoes;
DROP POLICY IF EXISTS "Comite ve movimentacoes" ON public.denuncias_movimentacoes;
CREATE POLICY "Comite ve movimentacoes" ON public.denuncias_movimentacoes
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Users can insert movimentacoes in their empresa" ON public.denuncias_movimentacoes;
DROP POLICY IF EXISTS "Comite regista movimentacoes" ON public.denuncias_movimentacoes;
CREATE POLICY "Comite regista movimentacoes" ON public.denuncias_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Admins or responsavel can view denuncia anexos" ON public.denuncias_anexos;
DROP POLICY IF EXISTS "Comite ve anexos" ON public.denuncias_anexos;
CREATE POLICY "Comite ve anexos" ON public.denuncias_anexos
  FOR SELECT TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id));

DROP POLICY IF EXISTS "Users can insert anexos in their empresa" ON public.denuncias_anexos;
DROP POLICY IF EXISTS "Comite anexa a denuncia" ON public.denuncias_anexos;
CREATE POLICY "Comite anexa a denuncia" ON public.denuncias_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

-- Comité: quem administra a empresa gere a composição; quem é do comité vê-a.
ALTER TABLE public.denuncias_comite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin gere o comite" ON public.denuncias_comite;
DROP POLICY IF EXISTS "Admin gere o comite" ON public.denuncias_comite;
CREATE POLICY "Admin gere o comite" ON public.denuncias_comite
  FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin())
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin());

DROP POLICY IF EXISTS "Comite ve-se a si mesmo" ON public.denuncias_comite;
DROP POLICY IF EXISTS "Comite ve-se a si mesmo" ON public.denuncias_comite;
CREATE POLICY "Comite ve-se a si mesmo" ON public.denuncias_comite
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() AND public.e_do_comite_denuncias());

ALTER TABLE public.denuncias_impedimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comite gere impedimentos" ON public.denuncias_impedimentos;
DROP POLICY IF EXISTS "Comite gere impedimentos" ON public.denuncias_impedimentos;
CREATE POLICY "Comite gere impedimentos" ON public.denuncias_impedimentos
  FOR ALL TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id))
  WITH CHECK (public.pode_ver_denuncia(denuncia_id));

-- ─────────────────────────────────────────────────────────────────────────
-- 7. O bucket segue a mesma regra
-- ─────────────────────────────────────────────────────────────────────────
/*
  Caminho: `<empresa_id>/<denuncia_id>/<ficheiro>`. A pasta carrega os dois
  identificadores para a política poder decidir sem consultar o objecto.
*/
DROP POLICY IF EXISTS "denuncias_anexos_select" ON storage.objects;
DROP POLICY IF EXISTS "denuncias_anexos_select" ON storage.objects;
CREATE POLICY "denuncias_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'denuncias-anexos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    AND public.pode_ver_denuncia(((storage.foldername(name))[2])::uuid)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Rede de segurança
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bucket integer;
  v_comite integer;
  v_empresas_sem_comite integer;
BEGIN
  SELECT count(*) INTO v_bucket FROM storage.buckets WHERE id = 'denuncias-anexos';
  IF v_bucket = 0 THEN
    RAISE EXCEPTION 'canal de denúncia: o bucket de evidência não ficou criado';
  END IF;

  SELECT count(*) INTO v_comite FROM public.denuncias_comite;

  /*
    A pergunta certa não é "esta empresa tem comité?" — é "alguém que via
    antes deixou de ver?".

    Há empresas com denúncias e sem administrador nenhum: nesse caso, pela
    regra ANTIGA (`is_admin() OR responsavel_id = auth.uid()`), já não havia
    quem as visse. Exigir comité ali seria bloquear a migration por uma perda
    que não existe — foi o que aconteceu na primeira tentativa em produção.

    A guarda compara com o acesso que existia: só falha se alguém via antes e
    ninguém vê agora.
  */
  SELECT count(*) INTO v_empresas_sem_comite
  FROM (SELECT DISTINCT empresa_id FROM public.denuncias) d
  WHERE (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.empresa_id = d.empresa_id AND p.role IN ('admin','super_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.denuncias x
      WHERE x.empresa_id = d.empresa_id AND x.responsavel_id IS NOT NULL
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.denuncias_comite c WHERE c.empresa_id = d.empresa_id
  );

  IF v_empresas_sem_comite > 0 THEN
    RAISE EXCEPTION
      'canal de denúncia: % empresa(s) perderiam acesso às suas denúncias',
      v_empresas_sem_comite;
  END IF;

  RAISE NOTICE 'canal de denúncia onda 1: bucket criado, % membros de comité semeados', v_comite;
END $$;
