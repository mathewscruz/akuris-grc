-- Um item criado dentro da auditoria tem de chegar à lista de Controles.
--
-- Os dois conceitos continuam separados:
--   * auditoria_itens guarda o papel de trabalho (estado, prioridade e prova);
--   * controles guarda o controlo interno que a organização passa a gerir.
--
-- Ao importar um controlo existente, nada novo é criado. Ao escrever um item
-- manual sem escolher controlo, a base cria o controlo correspondente, liga-o
-- ao item e deixa `auditoria_itens_sincroniza_vinculo()` manter o âmbito em
-- `controles_auditorias`. A regra vive na base para também valer em integrações,
-- importações e futuros clientes, não apenas neste formulário React.

ALTER TABLE public.auditoria_itens
  ADD COLUMN IF NOT EXISTS controle_gerado_automaticamente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.auditoria_itens.controle_gerado_automaticamente IS
  'True quando controle_vinculado_id foi criado a partir deste item. Permite sincronizar o cadastro sem alterar controlos existentes importados.';

CREATE OR REPLACE FUNCTION public.auditoria_item_garante_controle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_controle_id uuid;
  v_criticidade text;
BEGIN
  v_criticidade := CASE lower(COALESCE(NEW.prioridade, 'media'))
    WHEN 'alta' THEN 'alto'
    WHEN 'critica' THEN 'critico'
    WHEN 'crítica' THEN 'critico'
    WHEN 'baixa' THEN 'baixo'
    ELSE 'medio'
  END;

  -- Sem vínculo significa "novo item", não "item invisível em Controles".
  IF NEW.controle_vinculado_id IS NULL THEN
    SELECT a.empresa_id
      INTO v_empresa_id
      FROM public.auditorias a
     WHERE a.id = NEW.auditoria_id;

    IF v_empresa_id IS NULL THEN
      RAISE EXCEPTION 'A auditoria % não existe', NEW.auditoria_id;
    END IF;

    -- Uma referência que perdeu o vínculo não deve virar duplicata. Código
    -- igual tem precedência; na ausência dele, reutilizamos o nome exato dentro
    -- da mesma empresa.
    SELECT c.id
      INTO v_controle_id
      FROM public.controles c
     WHERE c.empresa_id = v_empresa_id
       AND (
         (NULLIF(btrim(NEW.codigo), '') IS NOT NULL AND c.codigo = btrim(NEW.codigo))
         OR lower(btrim(c.nome)) = lower(btrim(NEW.titulo))
       )
     ORDER BY CASE
       WHEN NULLIF(btrim(NEW.codigo), '') IS NOT NULL AND c.codigo = btrim(NEW.codigo) THEN 0
       ELSE 1
     END,
     c.created_at,
     c.id
     LIMIT 1;

    IF v_controle_id IS NOT NULL THEN
      NEW.controle_vinculado_id := v_controle_id;
      NEW.controle_gerado_automaticamente := false;
      RETURN NEW;
    END IF;

    INSERT INTO public.controles (
      empresa_id,
      nome,
      descricao,
      tipo,
      status,
      criticidade,
      responsavel_id,
      proxima_avaliacao,
      area
    )
    VALUES (
      v_empresa_id,
      NEW.titulo,
      NEW.descricao,
      'detectivo',
      'ativo',
      v_criticidade,
      NEW.responsavel_id,
      NEW.prazo,
      'Auditoria'
    )
    RETURNING id INTO v_controle_id;

    NEW.controle_vinculado_id := v_controle_id;
    NEW.controle_gerado_automaticamente := true;
    RETURN NEW;
  END IF;

  -- Um controlo escolhido no seletor é canónico e não deve ser reescrito pelo
  -- título do papel de trabalho. Só sincronizamos aquele que nasceu do item.
  IF TG_OP = 'UPDATE'
     AND OLD.controle_gerado_automaticamente
     AND NEW.controle_vinculado_id = OLD.controle_vinculado_id THEN
    UPDATE public.controles
       SET nome = NEW.titulo,
           descricao = NEW.descricao,
           criticidade = v_criticidade,
           responsavel_id = NEW.responsavel_id,
           proxima_avaliacao = NEW.prazo,
           updated_at = now()
     WHERE id = NEW.controle_vinculado_id;

    NEW.controle_gerado_automaticamente := true;
  ELSIF TG_OP = 'INSERT'
     OR NEW.controle_vinculado_id IS DISTINCT FROM OLD.controle_vinculado_id THEN
    NEW.controle_gerado_automaticamente := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_item_garante_controle_trg ON public.auditoria_itens;
CREATE TRIGGER auditoria_item_garante_controle_trg
  BEFORE INSERT OR UPDATE OF titulo, descricao, prioridade, responsavel_id,
    prazo, controle_vinculado_id, auditoria_id
  ON public.auditoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_item_garante_controle();

-- Recupera os itens manuais já cadastrados, inclusive o caso que revelou o
-- defeito. Nomear a coluna no SET também aciona o gatilho de vínculo existente.
UPDATE public.auditoria_itens
   SET controle_vinculado_id = NULL
 WHERE controle_vinculado_id IS NULL;

COMMENT ON FUNCTION public.auditoria_item_garante_controle() IS
  'Cria um controlo para itens manuais de auditoria e mantém apenas esses controlos sincronizados com o respetivo papel de trabalho.';
