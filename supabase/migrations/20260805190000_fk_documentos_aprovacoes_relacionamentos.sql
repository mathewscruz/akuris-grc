-- AKURIS QA-003 — relacionamentos ausentes em public.documentos_aprovacoes
--
-- Motivo: a tabela foi criada (migration 20250723112905) com `documento_id` e
-- `solicitado_por` como UUID soltos, sem FK. Sem constraint declarada o
-- PostgREST não descobre relacionamento e a consulta usada pelo
-- NotificationCenter (`documentos:documento_id(nome)` +
-- `profiles:solicitado_por(nome)`) responde HTTP 400 / PGRST200, derrubando as
-- pendências de aprovação de documentos.
--
-- Esta migration é nova: nenhuma migration histórica foi alterada.
--
-- NÃO DESTRUTIVA: nenhuma linha é apagada, atualizada ou truncada. As duas FKs
-- são criadas com NOT VALID (lock curto, sem varredura da tabela) e só são
-- validadas quando a contagem de órfãos for zero. Se houver órfãos, a
-- constraint permanece NOT VALID: o PostgREST já descobre o relacionamento
-- (pg_constraint contype = 'f' independe de convalidated) e as linhas novas
-- passam a ser verificadas, enquanto o histórico legado é preservado para
-- análise/limpeza posterior por decisão de produto.
--
-- Semântica de exclusão escolhida:
--   * documento_id  -> ON DELETE CASCADE. A aprovação é registro filho do
--     documento e não tem significado sem ele (a própria RLS usa
--     documento_pertence_empresa(documento_id)). Mesmo padrão já adotado em
--     public.documentos_historico.
--   * solicitado_por -> ON DELETE SET NULL. A coluna é anulável e o histórico
--     de aprovação deve sobreviver à remoção do usuário solicitante
--     (profiles.user_id cai por cascata de auth.users).
--
-- Não criamos FK para `aprovador_id`: nenhum embed/consulta do produto depende
-- dela hoje, a coluna é NOT NULL (impediria SET NULL) e um CASCADE apagaria o
-- histórico de aprovações ao excluir um usuário, enquanto RESTRICT quebraria a
-- edge function delete-user-complete. Fica registrado como decisão consciente.
--
-- Índices: a constraint única (documento_id, aprovador_id) já cobre
-- documento_id como coluna líder, então o CASCADE não precisa de índice novo.

-- ---------------------------------------------------------------------------
-- 1) documento_id -> public.documentos(id)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_aprovacoes_documento_id_fkey'
      AND contype = 'f'
      AND conrelid = 'public.documentos_aprovacoes'::regclass
  ) THEN
    ALTER TABLE public.documentos_aprovacoes
      ADD CONSTRAINT documentos_aprovacoes_documento_id_fkey
      FOREIGN KEY (documento_id)
      REFERENCES public.documentos(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  orfas INT;
BEGIN
  SELECT COUNT(*) INTO orfas
  FROM public.documentos_aprovacoes a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documentos d WHERE d.id = a.documento_id
  );

  IF orfas = 0 THEN
    EXECUTE 'ALTER TABLE public.documentos_aprovacoes
             VALIDATE CONSTRAINT documentos_aprovacoes_documento_id_fkey';
  ELSE
    RAISE NOTICE
      'documentos_aprovacoes: % aprovacao(oes) sem documento correspondente; FK documento_id mantida NOT VALID (nenhum dado removido)',
      orfas;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) solicitado_por -> public.profiles(user_id)
-- ---------------------------------------------------------------------------
-- profiles.user_id é UNIQUE, portanto alvo válido de FK.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documentos_aprovacoes_solicitado_por_profiles_fkey'
      AND contype = 'f'
      AND conrelid = 'public.documentos_aprovacoes'::regclass
  ) THEN
    ALTER TABLE public.documentos_aprovacoes
      ADD CONSTRAINT documentos_aprovacoes_solicitado_por_profiles_fkey
      FOREIGN KEY (solicitado_por)
      REFERENCES public.profiles(user_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
DECLARE
  orfas INT;
BEGIN
  SELECT COUNT(*) INTO orfas
  FROM public.documentos_aprovacoes a
  WHERE a.solicitado_por IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = a.solicitado_por
    );

  IF orfas = 0 THEN
    EXECUTE 'ALTER TABLE public.documentos_aprovacoes
             VALIDATE CONSTRAINT documentos_aprovacoes_solicitado_por_profiles_fkey';
  ELSE
    RAISE NOTICE
      'documentos_aprovacoes: % linha(s) com solicitado_por sem profile; FK mantida NOT VALID (nenhum dado alterado)',
      orfas;
  END IF;
END $$;
