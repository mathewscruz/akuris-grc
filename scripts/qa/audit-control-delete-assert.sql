-- Execute AFTER the production migration and scope-sync trigger, in isolated QA DB.
DO $$
DECLARE
  v_item uuid; v_control uuid; v_other uuid; v_deleted_at timestamptz;
  v_count integer; v_blocked boolean;
BEGIN
  IF current_database() NOT LIKE 'akuris_qa_control_delete_%' THEN RAISE EXCEPTION 'QA database required'; END IF;
  ASSERT (SELECT count(*) FROM public.auditoria_itens WHERE controle_excluido_em IS NOT NULL) = 1, 'Only proven legacy deletion is archived';
  ASSERT (SELECT controle_excluido_em FROM public.auditoria_itens WHERE codigo='QA-DELETED' AND auditoria_id='00000000-0000-0000-0000-000000000001') = '2026-01-02'::timestamptz, 'Original delete timestamp retained';
  UPDATE public.auditoria_itens SET titulo='Edited legacy' WHERE codigo='QA-UNLINKED';
  ASSERT NOT EXISTS (SELECT 1 FROM public.controles), 'Legacy null-link edits never recreate controls';

  INSERT INTO public.auditoria_itens (auditoria_id,codigo,titulo)
  VALUES ('00000000-0000-0000-0000-000000000001','QA-NEW','New manual item')
  RETURNING id,controle_vinculado_id INTO v_item,v_control;
  ASSERT v_control IS NOT NULL, 'New manual items still create controls';
  ASSERT (SELECT codigo FROM public.controles WHERE id=v_control)='QA-NEW', 'Canonical code preserved';
  ASSERT EXISTS (SELECT 1 FROM public.controles_auditorias WHERE controle_id=v_control), 'Audit scope synchronized';
  UPDATE public.auditoria_itens SET titulo='Renamed' WHERE id=v_item;
  UPDATE public.auditoria_itens SET responsavel_id='00000000-0000-0000-0000-000000000033' WHERE id=v_item;
  ASSERT (SELECT nome FROM public.controles WHERE id=v_control)='Renamed', 'Auto-created controls still sync';
  INSERT INTO public.auditoria_itens_evidencias (item_id) VALUES (v_item);
  INSERT INTO public.auditoria_itens_comentarios (item_id) VALUES (v_item);
  DELETE FROM public.controles WHERE id=v_control;
  SELECT controle_excluido_em INTO v_deleted_at FROM public.auditoria_itens WHERE id=v_item;
  ASSERT v_deleted_at IS NOT NULL, 'Actual FK deletion archives item';
  ASSERT (SELECT controle_excluido_id FROM public.auditoria_itens WHERE id=v_item)=v_control, 'Deleted identity retained';
  ASSERT (SELECT controle_vinculado_id IS NULL AND NOT controle_gerado_automaticamente FROM public.auditoria_itens WHERE id=v_item), 'Link removed';
  ASSERT NOT EXISTS (SELECT 1 FROM public.controles WHERE id=v_control OR codigo='QA-NEW'), 'No resurrection during delete';
  ASSERT NOT EXISTS (SELECT 1 FROM public.controles_auditorias WHERE controle_id=v_control), 'Operational scope removed';
  ASSERT EXISTS (SELECT 1 FROM public.auditoria_itens_evidencias WHERE item_id=v_item), 'Evidence survives';
  ASSERT EXISTS (SELECT 1 FROM public.auditoria_itens_comentarios WHERE item_id=v_item), 'Comments survive';
  UPDATE public.auditoria_itens SET responsavel_id=NULL WHERE id=v_item;
  ASSERT (SELECT controle_excluido_em = v_deleted_at FROM public.auditoria_itens WHERE id=v_item), 'Related FK cleanup preserves archive';
  v_blocked := false;
  BEGIN
    UPDATE public.auditoria_itens SET titulo='Stale form', controle_vinculado_id=NULL WHERE id=v_item;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_blocked := SQLERRM='AUDIT_ITEM_CONTROL_DELETED'; END;
  ASSERT v_blocked, 'Stale form rejected with stable error';
  v_blocked := false;
  BEGIN
    UPDATE public.auditoria_itens SET controle_excluido_em=NULL,controle_excluido_id=NULL,status='concluido' WHERE id=v_item;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_blocked := SQLERRM='AUDIT_ITEM_CONTROL_DELETED'; END;
  ASSERT v_blocked, 'Cannot clear archive markers through direct API';
  ASSERT NOT EXISTS (SELECT 1 FROM public.controles WHERE codigo='QA-NEW'), 'No resurrection after edit';

  INSERT INTO public.controles (empresa_id,codigo,nome) VALUES ('00000000-0000-0000-0000-000000000011','QA-EXISTING','Canonical') RETURNING id INTO v_other;
  INSERT INTO public.auditoria_itens (auditoria_id,codigo,titulo,controle_vinculado_id) VALUES
  ('00000000-0000-0000-0000-000000000001','QA-EXISTING','Imported',v_other) RETURNING id INTO v_item;
  UPDATE public.auditoria_itens SET titulo='Paper title' WHERE id=v_item;
  ASSERT (SELECT nome FROM public.controles WHERE id=v_other)='Canonical', 'Imported controls are not rewritten';
  UPDATE public.auditoria_itens SET controle_vinculado_id=NULL WHERE id=v_item;
  ASSERT (SELECT controle_excluido_em IS NULL FROM public.auditoria_itens WHERE id=v_item), 'Intentional unlink is not deletion';
  UPDATE public.auditoria_itens SET titulo='Unlinked edit' WHERE id=v_item;
  SELECT count(*) INTO v_count FROM public.controles;
  ASSERT v_count=1, 'Unlinked edit creates no extra controls';
  UPDATE public.auditoria_itens SET controle_vinculado_id=v_other WHERE id=v_item;
  ASSERT EXISTS (SELECT 1 FROM public.controles_auditorias WHERE controle_id=v_other), 'Explicit relink of live work still works';
  RAISE NOTICE 'PASS: deletion, history, stale form, metadata, evidence, comments, tenant-safe backfill, creation, imports and explicit unlink/relink';
END $$;
