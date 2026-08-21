-- O comité passa a poder juntar evidência à apuração.
--
-- A aba Anexos só sabia descarregar, e não era descuido de interface: o balde
-- `denuncias-anexos` tinha uma única política, de SELECT. Não havia por onde
-- escrever. O `tipo_anexo` já previa `'evidencia'` e `'investigacao'` desde a
-- onda 1 — valores que nada podia produzir.
--
-- O efeito prático: o e-mail que o RH reencaminhou, a ata da entrevista, o
-- print do sistema — a prova recolhida durante a apuração vivia fora do
-- produto, em pastas de rede e caixas de correio. Numa auditoria ao canal é
-- exactamente isso que se pede para ver.
--
-- A política de escrita espelha a de leitura: mesma empresa na primeira pasta,
-- `pode_ver_denuncia` na segunda. Quem não pode abrir a denúncia não pode
-- juntar-lhe nada — nem apagar o que já lá está.

DROP POLICY IF EXISTS denuncias_anexos_insert ON storage.objects;
CREATE POLICY denuncias_anexos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'denuncias-anexos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.pode_ver_denuncia(((storage.foldername(name))[2])::uuid)
  );

/*
  Apagar prova é diferente de a juntar.

  Fica com o mesmo alcance, mas vale a pena dizer porque existe: sem DELETE,
  um ficheiro trocado por engano ficava para sempre no balde, e a linha em
  `denuncias_anexos` apagada deixava-o órfão e invisível. A trilha da denúncia
  regista quem apagou.
*/
DROP POLICY IF EXISTS denuncias_anexos_delete ON storage.objects;
CREATE POLICY denuncias_anexos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'denuncias-anexos'
    AND (storage.foldername(name))[1] = (public.get_user_empresa_id())::text
    AND public.pode_ver_denuncia(((storage.foldername(name))[2])::uuid)
  );

/* A linha de `denuncias_anexos` também tem de poder sair. */
DROP POLICY IF EXISTS "Comite remove anexos" ON public.denuncias_anexos;
CREATE POLICY "Comite remove anexos" ON public.denuncias_anexos
  FOR DELETE TO authenticated
  USING (public.pode_ver_denuncia(denuncia_id));

/*
  Quem juntou o quê.

  `uploaded_by` já existia em `denuncias_anexos` — e, tal como o `usuario_id`
  das movimentações, nunca foi preenchido por ninguém. Não vale a pena uma
  coluna nova: vale a pena o DEFAULT que faz a linha nascer assinada mesmo
  quando quem escreve se esquece.
*/
ALTER TABLE public.denuncias_anexos
  ALTER COLUMN uploaded_by SET DEFAULT auth.uid();

COMMENT ON COLUMN public.denuncias_anexos.uploaded_by IS
  'Quem do comité juntou o ficheiro. Nulo quando veio pelo canal público — aí '
  'o autor é anónimo por desenho, e guardar um id identificaria quem o canal '
  'promete não identificar.';

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'storage'
        AND policyname IN ('denuncias_anexos_select', 'denuncias_anexos_insert',
                           'denuncias_anexos_delete')) < 3 THEN
    RAISE EXCEPTION 'canal: o balde de anexos voltou a ser só de leitura';
  END IF;
  RAISE NOTICE 'canal: o comité pode juntar e remover evidência da apuração';
END $$;

-- ---------------------------------------------------------------------------
-- O ficheiro tem de sair quando a linha sai
-- ---------------------------------------------------------------------------

/*
  Descoberto a testar: apagar uma denúncia levava as linhas de
  `denuncias_anexos` em cascata e deixava os FICHEIROS no balde. Ficavam
  órfãos — invisíveis na aplicação, presentes no armazenamento.

  Não é arrumação. O expurgo da retenção, criado na migration anterior, apaga
  as denúncias vencidas porque o canal promete a quem denuncia que os registos
  são conservados por N meses. Sem esta parte, apagava-se a ficha e guardava-se
  a prova — o contrário exacto da promessa.

  E não se resolve em SQL: o Supabase proíbe apagar de `storage.objects`
  directamente («Direct deletion from storage tables is not allowed»), e faz
  bem — apagar a linha deixaria o ficheiro no S3, invisível e por pagar.

  Por isso, uma FILA. Quem apaga a linha deixa o caminho aqui; uma função de
  borda passa pela API de armazenamento e apaga a sério. A fila é a diferença
  entre uma falha que se vê e uma falha em silêncio: se ninguém a drenar, ela
  cresce e a consulta abaixo diz quanto.
*/
CREATE TABLE IF NOT EXISTS public.denuncias_ficheiros_por_apagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caminho text NOT NULL,
  empresa_id uuid,
  enfileirado_em timestamptz NOT NULL DEFAULT now(),
  apagado_em timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text
);

CREATE INDEX IF NOT EXISTS idx_ficheiros_por_apagar_pendentes
  ON public.denuncias_ficheiros_por_apagar(enfileirado_em)
  WHERE apagado_em IS NULL;

COMMENT ON TABLE public.denuncias_ficheiros_por_apagar IS
  'Ficheiros de anexo cuja linha já saiu e que faltam apagar do balde. É fila, '
  'não registo histórico: linhas com apagado_em preenchido podem ser podadas. '
  'Uma fila que cresce é sinal de que a função de borda parou.';

ALTER TABLE public.denuncias_ficheiros_por_apagar ENABLE ROW LEVEL SECURITY;
-- Ninguém lê pela aplicação: só a chave de serviço, que ignora a RLS.

CREATE OR REPLACE FUNCTION public.tg_anexo_enfileira_ficheiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  INSERT INTO public.denuncias_ficheiros_por_apagar (caminho, empresa_id)
  VALUES (OLD.arquivo_url, split_part(OLD.arquivo_url, '/', 1)::uuid);
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Um caminho estranho não pode impedir a denúncia de ser apagada.
  INSERT INTO public.denuncias_ficheiros_por_apagar (caminho, ultimo_erro)
  VALUES (OLD.arquivo_url, SQLERRM);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_anexo_enfileira_ficheiro ON public.denuncias_anexos;
CREATE TRIGGER trg_anexo_enfileira_ficheiro
  AFTER DELETE ON public.denuncias_anexos
  FOR EACH ROW EXECUTE FUNCTION public.tg_anexo_enfileira_ficheiro();

/* Os que já ficaram para trás entram na fila como os outros. */
INSERT INTO public.denuncias_ficheiros_por_apagar (caminho, empresa_id)
SELECT o.name, split_part(o.name, '/', 1)::uuid
FROM storage.objects o
WHERE o.bucket_id = 'denuncias-anexos'
  AND NOT EXISTS (SELECT 1 FROM public.denuncias_anexos a WHERE a.arquivo_url = o.name)
  AND NOT EXISTS (SELECT 1 FROM public.denuncias_ficheiros_por_apagar f
                  WHERE f.caminho = o.name AND f.apagado_em IS NULL);

/* O que a função de borda vai buscar e o que confirma de volta. */
CREATE OR REPLACE FUNCTION public.ficheiros_por_apagar(p_limite integer DEFAULT 200)
RETURNS TABLE(id uuid, caminho text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT f.id, f.caminho
  FROM public.denuncias_ficheiros_por_apagar f
  WHERE f.apagado_em IS NULL AND f.tentativas < 5
  ORDER BY f.enfileirado_em
  LIMIT greatest(1, least(p_limite, 500));
$function$;

CREATE OR REPLACE FUNCTION public.confirmar_ficheiros_apagados(
  p_ids uuid[], p_erro text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_linhas integer;
BEGIN
  IF p_erro IS NULL THEN
    UPDATE public.denuncias_ficheiros_por_apagar
    SET apagado_em = now() WHERE id = ANY(p_ids) AND apagado_em IS NULL;
  ELSE
    UPDATE public.denuncias_ficheiros_por_apagar
    SET tentativas = tentativas + 1, ultimo_erro = left(p_erro, 500)
    WHERE id = ANY(p_ids) AND apagado_em IS NULL;
  END IF;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas;
END $function$;

REVOKE ALL ON FUNCTION public.ficheiros_por_apagar(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ficheiros_por_apagar(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ficheiros_por_apagar(integer) TO service_role;
REVOKE ALL ON FUNCTION public.confirmar_ficheiros_apagados(uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_ficheiros_apagados(uuid[], text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_ficheiros_apagados(uuid[], text) TO service_role;

DO $$
DECLARE
  v_fila integer;
BEGIN
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'storage'
        AND policyname IN ('denuncias_anexos_select', 'denuncias_anexos_insert',
                           'denuncias_anexos_delete')) < 3 THEN
    RAISE EXCEPTION 'canal: o balde de anexos voltou a ser só de leitura';
  END IF;

  SELECT count(*) INTO v_fila
  FROM public.denuncias_ficheiros_por_apagar WHERE apagado_em IS NULL;
  RAISE NOTICE 'canal: o comité anexa evidência; % ficheiro(s) órfão(s) na fila de expurgo', v_fila;
END $$;
