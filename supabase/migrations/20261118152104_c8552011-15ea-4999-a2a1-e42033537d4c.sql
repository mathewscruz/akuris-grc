-- Catálogos globais: leitura só para quem tem sessão (regra explícita, sem USING (true)).
DROP POLICY IF EXISTS "Biblioteca legivel por autenticados" ON public.riscos_biblioteca;
CREATE POLICY "Biblioteca legivel por autenticados" ON public.riscos_biblioteca
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "crosswalk_leitura" ON public.gap_analysis_requirement_crosswalk;
CREATE POLICY "crosswalk_leitura" ON public.gap_analysis_requirement_crosswalk
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- Novidades só aparecem dentro do sistema: sem leitura anónima.
DROP POLICY IF EXISTS "Anyone can read changelog" ON public.changelog_entries;
DROP POLICY IF EXISTS "Authenticated users can read changelog" ON public.changelog_entries;
CREATE POLICY "Authenticated users can read changelog" ON public.changelog_entries
  FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
REVOKE SELECT ON public.changelog_entries FROM anon;

-- Upload de anexos de risco: pasta da empresa do utilizador e dono = quem envia.
DROP POLICY IF EXISTS "Users can upload riscos anexos for their empresa" ON storage.objects;
CREATE POLICY "Users can upload riscos anexos for their empresa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'riscos-anexos'
    AND owner_id = (select auth.uid())::text
    AND public.get_user_empresa_id() IS NOT NULL
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
  );