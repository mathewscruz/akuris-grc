-- Due Diligence: a avaliação não sabia a que fornecedor pertence.
--
-- `due_diligence_assessments` guardava apenas `fornecedor_nome` e
-- `fornecedor_email` em texto, sem chave estrangeira, e a aplicação juntava as
-- duas tabelas por igualdade de e-mail:
--
--   assessmentMap.get(fornecedor.email)
--
-- Três consequências, todas silenciosas:
--   · um fornecedor sem e-mail nunca mostrava histórico nenhum;
--   · mudar o e-mail de contacto órfã TODAS as avaliações anteriores — o
--     score volta a "Nunca avaliado" e o histórico desaparece do ecrã;
--   · dois fornecedores que partilhem o e-mail do gestor de conta passam a
--     mostrar o histórico um do outro.
--
-- `fornecedor_id` passa a ser a relação. As colunas de texto ficam: são o
-- registo de para onde o questionário foi de facto enviado no dia em que foi
-- enviado, e isso não deve mudar quando o cadastro muda.

ALTER TABLE public.due_diligence_assessments
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid;

-- NOT VALID: o backfill abaixo resolve o que consegue casar, mas uma base com
-- avaliações antigas pode ter e-mails que já não existem no cadastro. Validar
-- fica para depois do inventário, como se fez nas FKs de Contratos.
ALTER TABLE public.due_diligence_assessments
  DROP CONSTRAINT IF EXISTS due_diligence_assessments_fornecedor_id_fkey;

ALTER TABLE public.due_diligence_assessments
  ADD CONSTRAINT due_diligence_assessments_fornecedor_id_fkey
  FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL
  NOT VALID;

-- Backfill pelo único vínculo que existia: e-mail dentro da mesma empresa.
-- `lower(btrim(...))` porque a comparação em JavaScript era sensível a caixa e
-- a espaços, e havia registos a falhar só por isso.
UPDATE public.due_diligence_assessments a
   SET fornecedor_id = f.id
  FROM public.fornecedores f
 WHERE a.fornecedor_id IS NULL
   AND f.empresa_id = a.empresa_id
   AND f.email IS NOT NULL
   AND lower(btrim(f.email)) = lower(btrim(a.fornecedor_email));

CREATE INDEX IF NOT EXISTS idx_dd_assessments_fornecedor
  ON public.due_diligence_assessments (fornecedor_id);
