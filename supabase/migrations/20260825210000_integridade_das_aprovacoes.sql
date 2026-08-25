-- As aprovações passam a resistir a quem sai da empresa.
--
-- ## Três buracos de integridade, todos com o mesmo sintoma: fica preso
--
-- **1. `documentos_aprovacoes.documento_id` era `NOT VALID`.** A chave existia
-- mas o Postgres nunca verificou as linhas antigas, por isso havia pedidos a
-- apontar para documentos já apagados. Um pedido órfão continua a contar para
-- o total de aprovadores em `check_all_approvals`, logo o documento nunca
-- fecha — e ninguém o vê, porque a RLS só mostra a linha ao aprovador e ao
-- solicitante. Nem um administrador o consegue apagar.
--
-- **2. `documentos_aprovacoes.aprovador_id` não tinha chave nenhuma.** Ao
-- desligar uma pessoa, o seu perfil desaparecia e o pedido ficava a apontar
-- para um utilizador que já não existe. Mesmo efeito: contado, invisível,
-- eterno.
--
-- **3. `riscos.aprovador_id` e `riscos.aprovador_aceite` têm chave SEM
-- `ON DELETE`.** O oposto, e pior: o Postgres RECUSA apagar o perfil. Quem
-- tenta desligar alguém que é aprovador de um risco recebe um erro genérico
-- («Erro ao excluir perfil do usuário») e não tem onde reatribuir. A pessoa
-- não sai e o risco não avança.
--
-- ## As decisões
--
-- Aprovação de documento: `ON DELETE CASCADE` no aprovador. Se a pessoa a quem
-- se pediu a decisão já não existe, o PEDIDO também não faz sentido — some, e
-- o documento volta a poder receber um aprovador novo. Guardar um pedido para
-- um fantasma não é histórico, é bloqueio.
--
-- Aprovador de risco: `ON DELETE SET NULL`. Aqui o registo é o risco, que tem
-- de sobreviver a qualquer pessoa. O risco perde o aprovador (fica visível que
-- precisa de um novo) mas não se perde a si próprio.

-- ── 1. Limpar antes de validar ────────────────────────────────────────────

DELETE FROM public.documentos_aprovacoes a
WHERE NOT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = a.documento_id);

DELETE FROM public.documentos_aprovacoes a
WHERE a.aprovador_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = a.aprovador_id);

ALTER TABLE public.documentos_aprovacoes
  VALIDATE CONSTRAINT documentos_aprovacoes_documento_id_fkey;

-- ── 2. O aprovador passa a ser uma referência de verdade ──────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.documentos_aprovacoes'::regclass
      AND conname = 'documentos_aprovacoes_aprovador_id_fkey'
  ) THEN
    ALTER TABLE public.documentos_aprovacoes
      ADD CONSTRAINT documentos_aprovacoes_aprovador_id_fkey
      FOREIGN KEY (aprovador_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 3. Desligar alguém deixa de travar em riscos ──────────────────────────

ALTER TABLE public.riscos DROP CONSTRAINT IF EXISTS riscos_aprovador_id_fkey;
ALTER TABLE public.riscos
  ADD CONSTRAINT riscos_aprovador_id_fkey
  FOREIGN KEY (aprovador_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.riscos DROP CONSTRAINT IF EXISTS riscos_aprovador_aceite_fkey;
ALTER TABLE public.riscos
  ADD CONSTRAINT riscos_aprovador_aceite_fkey
  FOREIGN KEY (aprovador_aceite) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

DO $$
DECLARE v_pendentes integer;
BEGIN
  SELECT count(*) INTO v_pendentes FROM public.documentos_aprovacoes WHERE status = 'pendente';
  RAISE NOTICE 'aprovações: integridade reposta; % pedidos pendentes sobrevivem', v_pendentes;
END $$;
