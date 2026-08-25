-- Os segredos de integração passam a ser cifrados em repouso.
--
-- ## O problema
--
-- `integracoes_config.credenciais_encrypted` tinha nome de cifrado e guardava
-- `JSON.stringify` em claro: o token do Jira, a senha do ServiceNow, a chave
-- privada do Google. O RLS protege contra o inquilino vizinho e contra quem
-- não é admin — está provado. Mas não protege contra o que um cliente gigante
-- (SOC 2, ISO 27001) exige que se proteja: um dump de backup, um DBA da
-- infraestrutura, um comprometimento do lado do Postgres. Segredo em claro no
-- disco reprova nesses controlos, RLS ou não.
--
-- ## A abordagem, feita para NÃO partir integrações vivas
--
-- A parte perigosa de cifrar dados a sério é a janela em que metade está
-- cifrada e metade não. Evita-se com leitura RETROCOMPATÍVEL: a função que lê
-- decifra o formato novo E devolve tal e qual o JSON legado em claro. Enquanto
-- houver linhas por migrar, ambas funcionam. As edge functions passam a ler por
-- essa função, e deixam de saber (ou de se importar) qual é o formato.
--
--   escrita → gatilho cifra  → guarda `pgp:...`
--   leitura → função decifra `pgp:...`, ou devolve `{...}` legado intacto
--
-- A chave-mestra vive no Vault, fora da tabela. Quem tiver a tabela e não a
-- chave tem texto opaco.

-- ── A chave-mestra, no Vault ──
DO $$
DECLARE v_existe boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'credenciais_integracao_key')
    INTO v_existe;
  IF NOT v_existe THEN
    /*
      Gerada aqui, uma vez. `gen_random_bytes(32)` em base64 = 256 bits de
      chave. Fica no Vault, cifrada pela chave-raiz que o Supabase gere fora da
      base de dados. Em produção, rodar esta chave é uma operação à parte
      (decifrar tudo com a antiga, recifrar com a nova) — documentada, não
      automática.
    */
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'credenciais_integracao_key',
      'Chave simétrica das credenciais de integração (integracoes_config)'
    );
  END IF;
END $$;

-- ── Ler a chave, só para o servidor ──
CREATE OR REPLACE FUNCTION public.chave_credenciais_integracao()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_temp'
AS $function$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'credenciais_integracao_key'
  LIMIT 1;
$function$;

-- Ninguém a chama a não ser as funções abaixo, e o service_role.
REVOKE ALL ON FUNCTION public.chave_credenciais_integracao() FROM PUBLIC, anon, authenticated;

-- ── Cifrar (usada pelo gatilho) ──
CREATE OR REPLACE FUNCTION public.cifrar_credenciais(p_claro text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_chave text;
BEGIN
  IF p_claro IS NULL OR p_claro = '' THEN
    RETURN p_claro;
  END IF;
  -- Já cifrado? Não recifrar (evita duplo-cifrado num UPDATE que não toca no campo).
  IF p_claro LIKE 'pgp:%' THEN
    RETURN p_claro;
  END IF;
  v_chave := public.chave_credenciais_integracao();
  IF v_chave IS NULL THEN
    -- Sem chave, não se guarda em claro fingindo cifra: falha alto.
    RAISE EXCEPTION 'cifra de credenciais: chave-mestra ausente no Vault';
  END IF;
  RETURN 'pgp:' || encode(extensions.pgp_sym_encrypt(p_claro, v_chave), 'base64');
END $function$;

-- ── Decifrar (usada pelas edge functions, retrocompatível) ──
CREATE OR REPLACE FUNCTION public.ler_credenciais_integracao(p_config_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_bruto text;
  v_chave text;
BEGIN
  SELECT credenciais_encrypted INTO v_bruto
  FROM public.integracoes_config
  WHERE id = p_config_id;

  IF v_bruto IS NULL OR v_bruto = '' THEN
    RETURN NULL;
  END IF;

  /*
    Legado em claro. As linhas escritas antes desta migração começam por `{`
    (é JSON). Devolve-se tal e qual — é o que torna a transição sem janela de
    quebra. Uma escrita futura passa pelo gatilho e cifra-a.
  */
  IF left(v_bruto, 4) <> 'pgp:' THEN
    RETURN v_bruto;
  END IF;

  v_chave := public.chave_credenciais_integracao();
  IF v_chave IS NULL THEN
    RAISE EXCEPTION 'leitura de credenciais: chave-mestra ausente no Vault';
  END IF;
  RETURN extensions.pgp_sym_decrypt(decode(substr(v_bruto, 5), 'base64'), v_chave);
END $function$;

-- Só o service_role (edge functions) decifra. Nem anon, nem o utilizador comum.
REVOKE ALL ON FUNCTION public.ler_credenciais_integracao(uuid) FROM PUBLIC, anon, authenticated;

-- ── O gatilho que cifra na escrita ──
CREATE OR REPLACE FUNCTION public.tg_cifra_credenciais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.credenciais_encrypted IS DISTINCT FROM
     (CASE WHEN TG_OP = 'UPDATE' THEN OLD.credenciais_encrypted END) THEN
    NEW.credenciais_encrypted := public.cifrar_credenciais(NEW.credenciais_encrypted);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_cifra_credenciais ON public.integracoes_config;
CREATE TRIGGER trg_cifra_credenciais
  BEFORE INSERT OR UPDATE OF credenciais_encrypted ON public.integracoes_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_cifra_credenciais();

-- ── Migrar o que já existe, em claro, para cifrado ──
UPDATE public.integracoes_config
SET credenciais_encrypted = public.cifrar_credenciais(credenciais_encrypted)
WHERE credenciais_encrypted IS NOT NULL
  AND credenciais_encrypted <> ''
  AND left(credenciais_encrypted, 4) <> 'pgp:';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cifra_credenciais') THEN
    RAISE EXCEPTION 'credenciais: o gatilho de cifra não ficou instalado';
  END IF;
  -- Não pode sobrar nada em claro.
  IF EXISTS (
    SELECT 1 FROM public.integracoes_config
    WHERE credenciais_encrypted IS NOT NULL AND credenciais_encrypted <> ''
      AND left(credenciais_encrypted, 4) <> 'pgp:'
  ) THEN
    RAISE EXCEPTION 'credenciais: sobrou segredo em claro após a migração';
  END IF;
  RAISE NOTICE 'credenciais de integração: cifradas em repouso, leitura retrocompatível';
END $$;

