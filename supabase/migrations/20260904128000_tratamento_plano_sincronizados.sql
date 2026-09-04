/*
  Tratamento e plano de ação são duas visões do mesmo compromisso operacional.
  Alterar prazo, responsável, descrição ou estado em qualquer uma delas mantém
  a outra consistente. Aceite permanece no fluxo formal próprio do risco.
*/
CREATE OR REPLACE FUNCTION public.tg_tratamento_sincronizar_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := CASE lower(translate(COALESCE(NEW.status, 'pendente'), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'))
    WHEN 'em andamento' THEN 'em_andamento'
    WHEN 'concluido' THEN 'concluido'
    WHEN 'cancelado' THEN 'cancelado'
    ELSE 'pendente'
  END;

  UPDATE public.planos_acao p
     SET descricao = NEW.descricao,
         responsavel_id = CASE
           WHEN NEW.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND EXISTS (
              SELECT 1 FROM public.profiles perfil
              WHERE perfil.user_id = NEW.responsavel::uuid
            )
           THEN NEW.responsavel::uuid ELSE NULL END,
         prazo = NEW.prazo,
         status = v_status,
         updated_at = now()
   WHERE p.tratamento_risco_id = NEW.id
     AND (p.descricao, p.responsavel_id, p.prazo, p.status)
         IS DISTINCT FROM
          (NEW.descricao,
           CASE WHEN NEW.responsavel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 AND EXISTS (
                   SELECT 1 FROM public.profiles perfil
                   WHERE perfil.user_id = NEW.responsavel::uuid
                 )
                THEN NEW.responsavel::uuid ELSE NULL END,
          NEW.prazo, v_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tratamento_sincronizar_plano ON public.riscos_tratamentos;
CREATE TRIGGER trg_tratamento_sincronizar_plano
  AFTER UPDATE OF descricao, responsavel, prazo, status ON public.riscos_tratamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_tratamento_sincronizar_plano();

CREATE OR REPLACE FUNCTION public.tg_plano_sincronizar_tratamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.tratamento_risco_id IS NULL THEN RETURN NEW; END IF;
  v_status := CASE NEW.status
    WHEN 'em_andamento' THEN 'em andamento'
    WHEN 'concluido' THEN 'concluído'
    WHEN 'cancelado' THEN 'cancelado'
    ELSE 'pendente'
  END;

  UPDATE public.riscos_tratamentos t
     SET descricao = COALESCE(NEW.descricao, t.descricao),
         -- Não apaga o nome livre de um responsável legado ao editar outro
         -- campo do plano. Uma seleção válida continua substituindo-o.
         responsavel = COALESCE(NEW.responsavel_id::text, t.responsavel),
         prazo = NEW.prazo,
         status = v_status,
         updated_at = now()
   WHERE t.id = NEW.tratamento_risco_id
     AND (t.descricao, t.responsavel, t.prazo, t.status)
         IS DISTINCT FROM
         (COALESCE(NEW.descricao, t.descricao),
          COALESCE(NEW.responsavel_id::text, t.responsavel), NEW.prazo, v_status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plano_sincronizar_tratamento ON public.planos_acao;
CREATE TRIGGER trg_plano_sincronizar_tratamento
  AFTER UPDATE OF descricao, responsavel_id, prazo, status ON public.planos_acao
  FOR EACH ROW EXECUTE FUNCTION public.tg_plano_sincronizar_tratamento();

CREATE OR REPLACE FUNCTION public.tg_tratamento_exigir_fluxo_aceite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.tipo_tratamento = 'aceitar'
     AND (TG_OP = 'INSERT' OR OLD.tipo_tratamento IS DISTINCT FROM NEW.tipo_tratamento) THEN
    RAISE EXCEPTION 'USE_FLUXO_DE_ACEITE_FORMAL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tratamento_exigir_fluxo_aceite ON public.riscos_tratamentos;
CREATE TRIGGER trg_tratamento_exigir_fluxo_aceite
  BEFORE INSERT OR UPDATE OF tipo_tratamento ON public.riscos_tratamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_tratamento_exigir_fluxo_aceite();
