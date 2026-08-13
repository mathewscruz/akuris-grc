-- (2) Limpeza: matrizes sem configuração e sem riscos associados
DELETE FROM public.riscos_matrizes m
WHERE NOT EXISTS (SELECT 1 FROM public.riscos_matriz_configuracao c WHERE c.matriz_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM public.riscos r WHERE r.matriz_id = m.id);

-- (3) Evitar duplicados por nome dentro da empresa
CREATE UNIQUE INDEX IF NOT EXISTS riscos_matrizes_empresa_nome_uidx
  ON public.riscos_matrizes (empresa_id, lower(nome));

-- (1) Atomicidade: criar/atualizar matriz + configuração numa transação
CREATE OR REPLACE FUNCTION public.criar_matriz_com_configuracao(
  p_nome text,
  p_descricao text,
  p_escala_probabilidade jsonb,
  p_escala_impacto jsonb,
  p_niveis_risco jsonb,
  p_metodo_calculo text DEFAULT 'multiplicacao',
  p_matriz_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_matriz_id uuid;
BEGIN
  v_empresa_id := public.get_user_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'EMPRESA_NAO_ENCONTRADA';
  END IF;

  IF coalesce(btrim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'NOME_OBRIGATORIO';
  END IF;

  IF p_matriz_id IS NOT NULL THEN
    UPDATE public.riscos_matrizes
       SET nome = p_nome, descricao = p_descricao, updated_at = now()
     WHERE id = p_matriz_id AND empresa_id = v_empresa_id
     RETURNING id INTO v_matriz_id;

    IF v_matriz_id IS NULL THEN
      RAISE EXCEPTION 'MATRIZ_NAO_ENCONTRADA';
    END IF;
  ELSE
    INSERT INTO public.riscos_matrizes (nome, descricao, empresa_id)
    VALUES (p_nome, p_descricao, v_empresa_id)
    RETURNING id INTO v_matriz_id;
  END IF;

  INSERT INTO public.riscos_matriz_configuracao (
    matriz_id, escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo
  ) VALUES (
    v_matriz_id, p_escala_probabilidade, p_escala_impacto, p_niveis_risco,
    coalesce(nullif(p_metodo_calculo, ''), 'multiplicacao')
  )
  ON CONFLICT (matriz_id) DO UPDATE SET
    escala_probabilidade = EXCLUDED.escala_probabilidade,
    escala_impacto = EXCLUDED.escala_impacto,
    niveis_risco = EXCLUDED.niveis_risco,
    metodo_calculo = EXCLUDED.metodo_calculo,
    updated_at = now();

  RETURN v_matriz_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_matriz_com_configuracao(text, text, jsonb, jsonb, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_matriz_com_configuracao(text, text, jsonb, jsonb, jsonb, text, uuid) TO authenticated;