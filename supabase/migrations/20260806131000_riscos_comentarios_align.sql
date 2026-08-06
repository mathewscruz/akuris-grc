-- AKURIS QA-061 — cria ou reconcilia riscos_comentarios sem perder dados.
CREATE TABLE IF NOT EXISTS public.riscos_comentarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 risco_id uuid NOT NULL REFERENCES public.riscos(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 comentario text NOT NULL,
 mencoes text[],
 created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS risco_id uuid;
ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS comentario text;
ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS mencoes text[];
ALTER TABLE public.riscos_comentarios ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Não converte dados silenciosamente. Tipos incompatíveis precisam de uma decisão humana.
DO $$
DECLARE
 v_id_type text;
 v_risco_type text;
 v_user_type text;
 v_comentario_type text;
 v_mencoes_type text;
 v_created_type text;
 v_invalid bigint;
 v_pk record;
 v_fk record;
BEGIN
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_id_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='id' AND NOT a.attisdropped;
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_risco_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='risco_id' AND NOT a.attisdropped;
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_user_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='user_id' AND NOT a.attisdropped;
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_comentario_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='comentario' AND NOT a.attisdropped;
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_mencoes_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='mencoes' AND NOT a.attisdropped;
 SELECT format_type(a.atttypid, a.atttypmod) INTO v_created_type
 FROM pg_attribute a WHERE a.attrelid='public.riscos_comentarios'::regclass AND a.attname='created_at' AND NOT a.attisdropped;

 IF v_id_type <> 'uuid' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.id tem tipo %, esperado uuid; conversão automática foi recusada para evitar perda de dados.', v_id_type USING ERRCODE='42804';
 END IF;
 IF v_risco_type <> 'uuid' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.risco_id tem tipo %, esperado uuid para referenciar public.riscos(id).', v_risco_type USING ERRCODE='42804';
 END IF;
 IF v_user_type <> 'uuid' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.user_id tem tipo %, esperado uuid; conversão automática foi recusada para evitar perda de dados.', v_user_type USING ERRCODE='42804';
 END IF;
 IF v_comentario_type <> 'text' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.comentario tem tipo %, esperado text; conversão automática foi recusada para evitar perda de dados.', v_comentario_type USING ERRCODE='42804';
 END IF;
 IF v_mencoes_type <> 'text[]' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.mencoes tem tipo %, esperado text[]; converta explicitamente preservando os valores.', v_mencoes_type USING ERRCODE='42804';
 END IF;
 IF v_created_type <> 'timestamp with time zone' THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios.created_at tem tipo %, esperado timestamp with time zone; converta explicitamente preservando o fuso.', v_created_type USING ERRCODE='42804';
 END IF;

 SELECT count(*) INTO v_invalid FROM public.riscos_comentarios
 WHERE id IS NULL OR risco_id IS NULL OR user_id IS NULL OR comentario IS NULL OR created_at IS NULL;
 IF v_invalid > 0 THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios contém % linha(s) com id, risco_id, user_id, comentario ou created_at nulo; corrija-as antes da migração.', v_invalid USING ERRCODE='23502';
 END IF;
 IF EXISTS (SELECT id FROM public.riscos_comentarios GROUP BY id HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'QA-061: public.riscos_comentarios contém IDs duplicados; remova as duplicatas antes de criar PRIMARY KEY (id).' USING ERRCODE='23505';
 END IF;

 SELECT c.conname, pg_get_constraintdef(c.oid) AS definition INTO v_pk
 FROM pg_constraint c WHERE c.conrelid='public.riscos_comentarios'::regclass AND c.contype='p';
 IF v_pk.conname IS NOT NULL AND v_pk.definition <> 'PRIMARY KEY (id)' THEN
  RAISE EXCEPTION 'QA-061: chave primária incompatível %: %. Esperado exatamente PRIMARY KEY (id); reconcilie manualmente.', v_pk.conname, v_pk.definition USING ERRCODE='42830';
 END IF;

 -- Uma FK errada sobre risco_id é removível com segurança: constraints não carregam dados.
 FOR v_fk IN
  SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.conrelid='public.riscos_comentarios'::regclass AND c.contype='f'
    AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='risco_id')]::smallint[]
 LOOP
  IF v_fk.definition <> 'FOREIGN KEY (risco_id) REFERENCES riscos(id) ON DELETE CASCADE' THEN
   EXECUTE format('ALTER TABLE public.riscos_comentarios DROP CONSTRAINT %I', v_fk.conname);
  END IF;
 END LOOP;

 IF EXISTS (
  SELECT 1 FROM public.riscos_comentarios rc
  LEFT JOIN public.riscos r ON r.id=rc.risco_id WHERE r.id IS NULL
 ) THEN
  RAISE EXCEPTION 'QA-061: há comentários com risco_id órfão; corrija-os antes de criar FOREIGN KEY para public.riscos(id) ON DELETE CASCADE.' USING ERRCODE='23503';
 END IF;
END $$;

ALTER TABLE public.riscos_comentarios ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.riscos_comentarios ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.riscos_comentarios ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.riscos_comentarios ALTER COLUMN risco_id SET NOT NULL;
ALTER TABLE public.riscos_comentarios ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.riscos_comentarios ALTER COLUMN comentario SET NOT NULL;
ALTER TABLE public.riscos_comentarios ALTER COLUMN created_at SET NOT NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.riscos_comentarios'::regclass AND contype='p') THEN
  ALTER TABLE public.riscos_comentarios ADD CONSTRAINT riscos_comentarios_pkey PRIMARY KEY (id);
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.riscos_comentarios'::regclass AND contype='f'
    AND pg_get_constraintdef(oid)='FOREIGN KEY (risco_id) REFERENCES riscos(id) ON DELETE CASCADE'
 ) THEN
  ALTER TABLE public.riscos_comentarios ADD CONSTRAINT riscos_comentarios_risco_id_fkey FOREIGN KEY (risco_id) REFERENCES public.riscos(id) ON DELETE CASCADE;
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_risco ON public.riscos_comentarios(risco_id);
CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_user ON public.riscos_comentarios(user_id);
CREATE INDEX IF NOT EXISTS idx_riscos_comentarios_risco_created ON public.riscos_comentarios(risco_id,created_at DESC);
ALTER TABLE public.riscos_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver comentarios de riscos da empresa" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem ver comentarios de riscos da empresa" ON public.riscos_comentarios FOR SELECT
 USING (EXISTS (SELECT 1 FROM public.riscos r WHERE r.id=risco_id AND r.empresa_id=public.get_user_empresa_id()));
DROP POLICY IF EXISTS "Usuarios podem criar comentarios em riscos da empresa" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem criar comentarios em riscos da empresa" ON public.riscos_comentarios FOR INSERT
 WITH CHECK (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.id=risco_id AND r.empresa_id=public.get_user_empresa_id()));
DROP POLICY IF EXISTS "Usuarios podem editar proprios comentarios de risco" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem editar proprios comentarios de risco" ON public.riscos_comentarios FOR UPDATE
 USING (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.id=risco_id AND r.empresa_id=public.get_user_empresa_id()))
 WITH CHECK (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.id=risco_id AND r.empresa_id=public.get_user_empresa_id()));
DROP POLICY IF EXISTS "Usuarios podem deletar proprios comentarios de risco" ON public.riscos_comentarios;
CREATE POLICY "Usuarios podem deletar proprios comentarios de risco" ON public.riscos_comentarios FOR DELETE
 USING (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.riscos r WHERE r.id=risco_id AND r.empresa_id=public.get_user_empresa_id()));
NOTIFY pgrst, 'reload schema';
