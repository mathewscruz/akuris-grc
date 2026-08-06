-- AKURIS QA-055 — configuração padrão de matriz, segura sob concorrência.

CREATE OR REPLACE FUNCTION public.riscos_matriz_config_padrao()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT jsonb_build_object(
  'escala_probabilidade', jsonb_build_array(
   jsonb_build_object('valor','1','descricao','Muito Raro'), jsonb_build_object('valor','2','descricao','Raro'),
   jsonb_build_object('valor','3','descricao','Ocasional'), jsonb_build_object('valor','4','descricao','Provável'),
   jsonb_build_object('valor','5','descricao','Muito Provável')),
  'escala_impacto', jsonb_build_array(
   jsonb_build_object('valor','1','descricao','Insignificante'), jsonb_build_object('valor','2','descricao','Menor'),
   jsonb_build_object('valor','3','descricao','Moderado'), jsonb_build_object('valor','4','descricao','Maior'),
   jsonb_build_object('valor','5','descricao','Catastrófico')),
  'niveis_risco', jsonb_build_array(
   jsonb_build_object('min',1,'max',4,'nivel','Baixo','cor','#22c55e'),
   jsonb_build_object('min',5,'max',9,'nivel','Médio','cor','#eab308','apetite',true),
   jsonb_build_object('min',10,'max',16,'nivel','Alto','cor','#f97316'),
   jsonb_build_object('min',17,'max',25,'nivel','Crítico','cor','#dc2626')),
  'metodo_calculo','multiplicacao');
$$;

-- A unicidade é pré-requisito do ON CONFLICT, portanto é validada ANTES de
-- qualquer backfill/provisionamento. Dados ambíguos abortam explicitamente.
DO $$
DECLARE v_duplicates text;
BEGIN
 SELECT string_agg(matriz_id::text, ', ' ORDER BY matriz_id::text) INTO v_duplicates
 FROM (SELECT matriz_id FROM public.riscos_matriz_configuracao GROUP BY matriz_id HAVING count(*) > 1) d;
 IF v_duplicates IS NOT NULL THEN
  RAISE EXCEPTION 'QA-055: configurações duplicadas para matriz(es): %. Corrija os dados antes de aplicar a migração.', v_duplicates
   USING ERRCODE = '23505';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_riscos_matriz_configuracao_matriz
 ON public.riscos_matriz_configuracao (matriz_id);

CREATE OR REPLACE FUNCTION public.riscos_provisionar_matriz_padrao(p_empresa_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_config jsonb := public.riscos_matriz_config_padrao(); v_matriz_id uuid;
BEGIN
 IF p_empresa_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.empresas WHERE id=p_empresa_id) THEN
  RETURN NULL;
 END IF;
 -- Serializa todas as tentativas para o mesmo tenant, inclusive trigger/backfill/RPC.
 PERFORM pg_advisory_xact_lock(hashtextextended('riscos-matriz:' || p_empresa_id::text, 0));
 SELECT id INTO v_matriz_id FROM public.riscos_matrizes
  WHERE empresa_id=p_empresa_id ORDER BY created_at,id LIMIT 1;
 IF v_matriz_id IS NULL THEN
  INSERT INTO public.riscos_matrizes(empresa_id,nome,descricao)
   VALUES(p_empresa_id,'Matriz Padrão 5×5','Matriz padrão de probabilidade × impacto (5×5) criada automaticamente.')
   RETURNING id INTO v_matriz_id;
 END IF;
 INSERT INTO public.riscos_matriz_configuracao
  (matriz_id,escala_probabilidade,escala_impacto,niveis_risco,metodo_calculo)
 SELECT m.id,v_config->'escala_probabilidade',v_config->'escala_impacto',v_config->'niveis_risco',v_config->>'metodo_calculo'
 FROM public.riscos_matrizes m WHERE m.empresa_id=p_empresa_id
 ON CONFLICT (matriz_id) DO NOTHING;
 RETURN v_matriz_id;
END $$;
REVOKE ALL ON FUNCTION public.riscos_provisionar_matriz_padrao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.riscos_provisionar_matriz_padrao(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.garantir_matriz_risco_padrao(p_empresa_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
 IF p_empresa_id IS DISTINCT FROM public.get_user_empresa_id() THEN
  RAISE EXCEPTION 'Empresa fora do escopo do usuário' USING ERRCODE='42501';
 END IF;
 RETURN public.riscos_provisionar_matriz_padrao(p_empresa_id);
END $$;
REVOKE ALL ON FUNCTION public.garantir_matriz_risco_padrao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantir_matriz_risco_padrao(uuid) TO authenticated;

DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT id FROM public.empresas ORDER BY id LOOP
  PERFORM public.riscos_provisionar_matriz_padrao(r.id);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_empresa_matriz_risco_padrao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 PERFORM public.riscos_provisionar_matriz_padrao(NEW.id);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_empresa_matriz_risco_padrao ON public.empresas;
CREATE TRIGGER trg_empresa_matriz_risco_padrao AFTER INSERT ON public.empresas
 FOR EACH ROW EXECUTE FUNCTION public.tg_empresa_matriz_risco_padrao();
NOTIFY pgrst, 'reload schema';
