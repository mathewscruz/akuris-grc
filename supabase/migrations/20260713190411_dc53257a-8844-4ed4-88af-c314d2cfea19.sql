-- Deduplicate gap_analysis_requirements within global frameworks (empresa_id IS NULL)
-- Keep the "best" row per (framework_id, codigo): longest descricao+orientacao, most recent as tiebreaker.
-- Before deleting losers, remap FK references in dependent tables to the surviving requirement_id.

DO $$
DECLARE
  v_keep uuid;
  v_dup record;
  v_losers uuid[];
BEGIN
  FOR v_dup IN
    SELECT r.framework_id, r.codigo
    FROM public.gap_analysis_requirements r
    JOIN public.gap_analysis_frameworks f ON f.id = r.framework_id
    WHERE f.empresa_id IS NULL AND r.codigo IS NOT NULL
    GROUP BY r.framework_id, r.codigo
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keep
    FROM public.gap_analysis_requirements
    WHERE framework_id = v_dup.framework_id AND codigo = v_dup.codigo
    ORDER BY
      (COALESCE(length(descricao),0) + COALESCE(length(orientacao_implementacao),0)) DESC,
      updated_at DESC,
      created_at DESC,
      id
    LIMIT 1;

    SELECT array_agg(id) INTO v_losers
    FROM public.gap_analysis_requirements
    WHERE framework_id = v_dup.framework_id AND codigo = v_dup.codigo AND id <> v_keep;

    IF v_losers IS NULL OR array_length(v_losers, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Remap FK-like references. Use ON CONFLICT DO NOTHING semantics where possible via delete-of-losers path.
    UPDATE public.gap_analysis_evaluations SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);
    UPDATE public.gap_analysis_adherence_details SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);
    UPDATE public.gap_analysis_assignments SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);
    UPDATE public.gap_analysis_audit_log SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);
    UPDATE public.gap_analysis_soa SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);
    UPDATE public.evidence_library_links SET requirement_id = v_keep WHERE requirement_id = ANY(v_losers);

    -- After remap, drop duplicates that may now violate uniqueness in evaluations (same empresa+requirement)
    DELETE FROM public.gap_analysis_evaluations a
    USING public.gap_analysis_evaluations b
    WHERE a.requirement_id = v_keep AND b.requirement_id = v_keep
      AND a.empresa_id IS NOT DISTINCT FROM b.empresa_id
      AND a.ctid < b.ctid;

    DELETE FROM public.gap_analysis_requirements WHERE id = ANY(v_losers);
  END LOOP;
END $$;

-- Optional: add a unique index to prevent future duplication in global templates
CREATE UNIQUE INDEX IF NOT EXISTS ux_gap_req_framework_codigo
  ON public.gap_analysis_requirements (framework_id, codigo)
  WHERE codigo IS NOT NULL;