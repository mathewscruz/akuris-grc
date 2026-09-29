BEGIN;
-- Reuse the existing private library; do not migrate or copy customer files.
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('gap-evidence-library','gap-evidence-library',false,52428800)
ON CONFLICT(id) DO NOTHING;
UPDATE storage.buckets SET public=false WHERE id='gap-evidence-library';
-- Restore the documented library policies if a local installation is missing them.
-- Matching named legacy policies are narrowed, not supplemented with a permissive bypass.
DROP POLICY IF EXISTS gap_evidence_library_select ON storage.objects;
DROP POLICY IF EXISTS gap_evidence_library_insert ON storage.objects;
DROP POLICY IF EXISTS gap_evidence_library_update ON storage.objects;
DROP POLICY IF EXISTS gap_evidence_library_delete ON storage.objects;
CREATE POLICY gap_evidence_library_select ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='gap-evidence-library' AND (storage.foldername(name))[1]=(SELECT public.get_user_empresa_id())::text
 AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','read')));
CREATE POLICY gap_evidence_library_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='gap-evidence-library' AND (storage.foldername(name))[1]=(SELECT public.get_user_empresa_id())::text
 AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','create')));
CREATE POLICY gap_evidence_library_update ON storage.objects FOR UPDATE TO authenticated USING (
 bucket_id='gap-evidence-library' AND (storage.foldername(name))[1]=(SELECT public.get_user_empresa_id())::text
 AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','update')))
 WITH CHECK (bucket_id='gap-evidence-library' AND (storage.foldername(name))[1]=(SELECT public.get_user_empresa_id())::text
 AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','update')));
CREATE POLICY gap_evidence_library_delete ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='gap-evidence-library' AND (storage.foldername(name))[1]=(SELECT public.get_user_empresa_id())::text
 AND (SELECT public.has_valid_mfa_session()) AND (SELECT public.usuario_tem_permissao_modulo('gap-analysis','delete')));
-- A validated CRA attachment is immutable. Unlinking retains its historical file.
CREATE POLICY regulatory_library_preserve_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (
 bucket_id<>'gap-evidence-library' OR NOT EXISTS (
 SELECT 1 FROM public.evidence_library e WHERE e.empresa_id=(SELECT public.get_user_empresa_id()) AND e.arquivo_url=name
 AND (EXISTS(SELECT 1 FROM public.regulatory_evidence_links l WHERE l.evidence_id=e.id)
 OR EXISTS(SELECT 1 FROM public.regulatory_sboms s WHERE s.evidence_id=e.id))));
CREATE POLICY regulatory_library_preserve_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
 bucket_id<>'gap-evidence-library' OR NOT EXISTS (
 SELECT 1 FROM public.evidence_library e WHERE e.empresa_id=(SELECT public.get_user_empresa_id()) AND e.arquivo_url=name
 AND (EXISTS(SELECT 1 FROM public.regulatory_evidence_links l WHERE l.evidence_id=e.id)
 OR EXISTS(SELECT 1 FROM public.regulatory_sboms s WHERE s.evidence_id=e.id))));
-- Preserve chronological ordering when several answers are changed in one transaction.
ALTER TABLE public.regulatory_assessment_scores ALTER COLUMN created_at SET DEFAULT clock_timestamp();
COMMIT;
