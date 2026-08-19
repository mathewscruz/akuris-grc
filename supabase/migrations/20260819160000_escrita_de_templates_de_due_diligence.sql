-- Due Diligence: templates e perguntas eram tabelas só de leitura.
--
-- `due_diligence_templates` e `due_diligence_questions` tinham RLS ligada e
-- apenas políticas de SELECT. Sem política permissiva de escrita, o Postgres
-- nega todo INSERT/UPDATE/DELETE — e negava mesmo:
--
--   new row violates row-level security policy for table "due_diligence_templates"
--
-- O efeito não era um botão partido, era o módulo inteiro. Não se criava
-- template, não se usava nenhum dos três modelos sugeridos no topo do ecrã,
-- não se editava nem apagava, e não se acrescentava uma pergunta. Como
-- `due_diligence_assessments.template_id` é NOT NULL, uma empresa nova nunca
-- conseguia sequer começar: chegava a um separador vazio e todos os caminhos
-- para o preencher falhavam em silêncio, com um toast genérico.
--
-- As tabelas irmãs (assessments, responses, scores, integrations) já tinham o
-- conjunto completo. Estas duas ficaram para trás. As políticas abaixo copiam
-- exactamente esse padrão.

-- Reaplicável: cada política é derrubada antes de ser criada. Sem isto, uma
-- base onde parte delas já exista faz a migration falhar e aborta o push
-- inteiro — e é precisamente o caso quando o Lovable aplicou uma parte.

-- ---------------------------------------------------------------------------
-- Templates: escrita restrita à própria empresa.
--
-- A leitura permite ver modelos `padrao = true` de fora da empresa; a escrita
-- NÃO os inclui, para que um modelo partilhado não possa ser alterado ou
-- apagado por quem apenas o consome.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users insert templates in their empresa" ON public.due_diligence_templates;
CREATE POLICY "Authenticated users insert templates in their empresa"
  ON public.due_diligence_templates FOR INSERT
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Authenticated users update templates from their empresa" ON public.due_diligence_templates;
CREATE POLICY "Authenticated users update templates from their empresa"
  ON public.due_diligence_templates FOR UPDATE
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Authenticated users delete templates from their empresa" ON public.due_diligence_templates;
CREATE POLICY "Authenticated users delete templates from their empresa"
  ON public.due_diligence_templates FOR DELETE
  USING (empresa_id = get_user_empresa_id());

-- ---------------------------------------------------------------------------
-- Perguntas: não têm `empresa_id` — pertencem a um template. A autorização
-- atravessa o template, tal como já fazem as políticas de leitura.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users insert questions in their templates" ON public.due_diligence_questions;
CREATE POLICY "Authenticated users insert questions in their templates"
  ON public.due_diligence_questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id
      AND t.empresa_id = get_user_empresa_id()
  ));

DROP POLICY IF EXISTS "Authenticated users update questions from their templates" ON public.due_diligence_questions;
CREATE POLICY "Authenticated users update questions from their templates"
  ON public.due_diligence_questions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id
      AND t.empresa_id = get_user_empresa_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id
      AND t.empresa_id = get_user_empresa_id()
  ));

DROP POLICY IF EXISTS "Authenticated users delete questions from their templates" ON public.due_diligence_questions;
CREATE POLICY "Authenticated users delete questions from their templates"
  ON public.due_diligence_questions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.due_diligence_templates t
    WHERE t.id = due_diligence_questions.template_id
      AND t.empresa_id = get_user_empresa_id()
  ));
