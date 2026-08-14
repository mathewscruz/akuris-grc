ALTER TABLE public.riscos
  ADD COLUMN IF NOT EXISTS aceite_valido_ate date,
  ADD COLUMN IF NOT EXISTS historico_aceite jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.expirar_aceites_riscos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_expirados int := 0;
  v_avisos int := 0;
  v_dest uuid;
  v_dias int;
BEGIN
  -- 1) Avisos: 30 dias antes e no dia da expiracao
  FOR r IN
    SELECT id, nome, empresa_id, aprovador_aceite, responsavel, aceite_valido_ate
    FROM public.riscos
    WHERE aceito = true
      AND aceite_valido_ate IS NOT NULL
      AND aceite_valido_ate IN (CURRENT_DATE, CURRENT_DATE + 30)
  LOOP
    v_dias := r.aceite_valido_ate - CURRENT_DATE;
    FOREACH v_dest IN ARRAY ARRAY(
      SELECT DISTINCT x FROM unnest(ARRAY[
        r.aprovador_aceite,
        CASE WHEN r.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN r.responsavel::uuid ELSE NULL END
      ]) AS x WHERE x IS NOT NULL
    )
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_dest
          AND n.metadata->>'tipo' = 'risco_aceite_validade'
          AND n.metadata->>'risco_id' = r.id::text
          AND n.metadata->>'dias' = v_dias::text
      ) THEN
        INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
        VALUES (
          v_dest,
          CASE WHEN v_dias = 0
               THEN 'Aceite de risco expira hoje'
               ELSE 'Aceite de risco expira em 30 dias' END,
          'O aceite formal do risco "' || r.nome || '" ' ||
          CASE WHEN v_dias = 0 THEN 'expira hoje (' ELSE 'expira em (' END
          || to_char(r.aceite_valido_ate, 'DD/MM/YYYY') || '). É necessária uma re-atestação.',
          CASE WHEN v_dias = 0 THEN 'warning' ELSE 'info' END,
          '/riscos/aceite',
          jsonb_build_object('tipo', 'risco_aceite_validade', 'risco_id', r.id, 'dias', v_dias)
        );
        v_avisos := v_avisos + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- 2) Reabertura automatica dos aceites vencidos
  FOR r IN
    SELECT id, nome, empresa_id, aprovador_aceite, responsavel, aceite_valido_ate,
           justificativa_aceite, data_aceite
    FROM public.riscos
    WHERE aceito = true
      AND aceite_valido_ate IS NOT NULL
      AND aceite_valido_ate < CURRENT_DATE
  LOOP
    UPDATE public.riscos
    SET aceito = false,
        status_aceite = 'expirado',
        status = 'em_revisao',
        historico_aceite = COALESCE(historico_aceite, '[]'::jsonb) || jsonb_build_object(
          'evento', 'expirado',
          'em', now(),
          'valido_ate', r.aceite_valido_ate,
          'aprovador', r.aprovador_aceite,
          'justificativa', r.justificativa_aceite
        ),
        updated_at = now()
    WHERE id = r.id;
    v_expirados := v_expirados + 1;

    FOREACH v_dest IN ARRAY ARRAY(
      SELECT DISTINCT x FROM unnest(ARRAY[
        r.aprovador_aceite,
        CASE WHEN r.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN r.responsavel::uuid ELSE NULL END
      ]) AS x WHERE x IS NOT NULL
    )
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link_to, metadata)
      VALUES (
        v_dest,
        'Aceite de risco expirado',
        'O aceite do risco "' || r.nome || '" expirou e o risco voltou ao estado "Em revisão".',
        'warning',
        '/riscos/aceite',
        jsonb_build_object('tipo', 'risco_aceite_expirado', 'risco_id', r.id)
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('expirados', v_expirados, 'avisos', v_avisos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expirar_aceites_riscos() TO authenticated, service_role;

SELECT cron.unschedule('expirar-aceites-riscos-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expirar-aceites-riscos-diario');

SELECT cron.schedule('expirar-aceites-riscos-diario', '0 4 * * *', $$SELECT public.expirar_aceites_riscos();$$);