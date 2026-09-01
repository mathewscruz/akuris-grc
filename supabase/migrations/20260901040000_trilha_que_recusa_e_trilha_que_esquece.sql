/*
   A trilha de auditoria recusava escritas e esquecia alterações.

   ## 1. Recusava

   `create_audit_log` grava `get_user_empresa_id()` em `audit_logs.empresa_id`,
   que é NOT NULL. Sem sessão de utilizador essa função devolve NULL, o INSERT
   na trilha falha, e como o gatilho corre dentro da transacção, **a escrita
   original aborta com ele**.

   Quem escreve sem sessão são as integrações. Medido na base local, com o papel
   `service_role`:

       insert into ativos(...)  -> ERROR: null value in column "empresa_id"
       update ativos set nome=  -> ERROR: null value in column "empresa_id"

   Duas funções de borda fazem exactamente isso e nunca podem ter funcionado:

     · `api-inbound-webhook` — `.from('ativos').insert(...)` e
       `.from('controles').insert(...)`. É o ponto de entrada por onde um
       sistema externo regista activos e controlos.
     · `azure-integration` — `.from('ativos').insert(...)` e `.update(...)`.
       É a sincronização de activos do Azure, inteira.

   Só `ativos` e `controles` chamam `create_audit_log`; as outras cinco tabelas
   com gatilho de auditoria escrevem noutro sítio e não tinham este problema.

   A correcção não é tornar a coluna nula — numa ferramenta de conformidade uma
   linha de trilha sem inquilino é uma linha que a RLS não sabe mostrar a
   ninguém. É passar o `empresa_id` **do próprio registo**, que o gatilho tem à
   mão em `NEW`/`OLD` e que é a resposta certa: a trilha pertence à empresa do
   dado, não à de quem por acaso está autenticado. Isso arruma de caminho um
   segundo caso — um super-admin a mexer no registo de outra empresa carimbava
   a trilha com a empresa DELE.

   O `user_id` fica NULL quando não há pessoa, e é a verdade: foi a integração.

   ## 2. Esquecia

   Os gatilhos comparam campo a campo para saber o que mudou, e usam `!=` em
   colunas que aceitam NULL. `NULL != 'x'` não é verdadeiro — é NULL — por isso
   entrar em NULL ou sair de NULL **não conta como alteração**, e a linha de
   trilha nem chega a ser escrita.

   São três colunas: `ativos.status`, `ativos.criticidade` e
   `controles.descricao`. Medido: uma trilha com 7 registos ficou em 7 depois de
   pôr o estado do activo a NULL, ficou em 7 depois de lhe dar estado outra vez,
   e só foi a 8 quando a mudança foi entre dois valores. Numa ferramenta de GRC
   a trilha é o produto; classificar um activo pela primeira vez é precisamente
   o que um auditor vai perguntar.

   `IS DISTINCT FROM` em todas — nas que aceitam NULL porque é preciso, nas
   outras porque a próxima coluna a passar a aceitar NULL não deve reabrir isto.
*/

-- Assinatura nova, com o inquilino do registo. A antiga fica, com o mesmo
-- corpo, para não partir nada que a chame com seis argumentos.
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_old_values jsonb,
  p_new_values jsonb,
  p_changed_fields text[],
  p_empresa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id, empresa_id, table_name, record_id, action,
    old_values, new_values, changed_fields
  ) VALUES (
    auth.uid(),
    -- O inquilino do REGISTO. `get_user_empresa_id()` só entra quando o
    -- registo não traz nenhum, e aí é melhor do que nada.
    COALESCE(p_empresa_id, get_user_empresa_id()),
    p_table_name, p_record_id, p_action,
    p_old_values, p_new_values, p_changed_fields
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_ativos_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  changed_fields text[] := '{}';
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_values = to_jsonb(NEW);
    PERFORM create_audit_log('ativos', NEW.id, 'INSERT', NULL, new_values, NULL, NEW.empresa_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_values = to_jsonb(OLD);
    new_values = to_jsonb(NEW);

    -- `IS DISTINCT FROM`, não `!=`: entrar ou sair de NULL é uma alteração.
    IF OLD.nome IS DISTINCT FROM NEW.nome THEN changed_fields = array_append(changed_fields, 'nome'); END IF;
    IF OLD.tipo IS DISTINCT FROM NEW.tipo THEN changed_fields = array_append(changed_fields, 'tipo'); END IF;
    IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN changed_fields = array_append(changed_fields, 'descricao'); END IF;
    IF OLD.proprietario IS DISTINCT FROM NEW.proprietario THEN changed_fields = array_append(changed_fields, 'proprietario'); END IF;
    IF OLD.localizacao IS DISTINCT FROM NEW.localizacao THEN changed_fields = array_append(changed_fields, 'localizacao'); END IF;
    IF OLD.valor_negocio IS DISTINCT FROM NEW.valor_negocio THEN changed_fields = array_append(changed_fields, 'valor_negocio'); END IF;
    IF OLD.criticidade IS DISTINCT FROM NEW.criticidade THEN changed_fields = array_append(changed_fields, 'criticidade'); END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN changed_fields = array_append(changed_fields, 'status'); END IF;
    IF OLD.data_aquisicao IS DISTINCT FROM NEW.data_aquisicao THEN changed_fields = array_append(changed_fields, 'data_aquisicao'); END IF;
    IF OLD.fornecedor IS DISTINCT FROM NEW.fornecedor THEN changed_fields = array_append(changed_fields, 'fornecedor'); END IF;
    IF OLD.versao IS DISTINCT FROM NEW.versao THEN changed_fields = array_append(changed_fields, 'versao'); END IF;
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN changed_fields = array_append(changed_fields, 'tags'); END IF;
    IF OLD.imei IS DISTINCT FROM NEW.imei THEN changed_fields = array_append(changed_fields, 'imei'); END IF;
    IF OLD.cliente IS DISTINCT FROM NEW.cliente THEN changed_fields = array_append(changed_fields, 'cliente'); END IF;
    IF OLD.quantidade IS DISTINCT FROM NEW.quantidade THEN changed_fields = array_append(changed_fields, 'quantidade'); END IF;

    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM create_audit_log('ativos', NEW.id, 'UPDATE', old_values, new_values, changed_fields, NEW.empresa_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_values = to_jsonb(OLD);
    PERFORM create_audit_log('ativos', OLD.id, 'DELETE', old_values, NULL, NULL, OLD.empresa_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_controles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  changed_fields text[] := '{}';
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_values = to_jsonb(NEW);
    PERFORM create_audit_log('controles', NEW.id, 'INSERT', NULL, new_values, NULL, NEW.empresa_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_values = to_jsonb(OLD);
    new_values = to_jsonb(NEW);

    -- `descricao` aceita NULL, e com `!=` a primeira descrição de um controlo
    -- nunca entrava na trilha.
    IF OLD.nome IS DISTINCT FROM NEW.nome THEN changed_fields = array_append(changed_fields, 'nome'); END IF;
    IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN changed_fields = array_append(changed_fields, 'descricao'); END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN changed_fields = array_append(changed_fields, 'status'); END IF;
    IF OLD.criticidade IS DISTINCT FROM NEW.criticidade THEN changed_fields = array_append(changed_fields, 'criticidade'); END IF;

    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM create_audit_log('controles', NEW.id, 'UPDATE', old_values, new_values, changed_fields, NEW.empresa_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_values = to_jsonb(OLD);
    PERFORM create_audit_log('controles', OLD.id, 'DELETE', old_values, NULL, NULL, OLD.empresa_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;
