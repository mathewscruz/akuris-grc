-- Seis funcionalidades estão mortas em produção por falta de policy de INSERT.
--
-- Encontradas ao trazer uma cópia da base de produção para o ambiente local e
-- correr `scripts/auditoria-rls.sql` contra ela. A base local de
-- desenvolvimento não as mostrava: foi construída a partir de um baseline com
-- políticas diferentes, e por isso escondia o problema.
--
-- Em todas as seis a tabela tem RLS LIGADO e ZERO políticas permissivas de
-- INSERT. Em Postgres isso não é um aviso — é negação de todas as inserções,
-- por definição. Confirmado tabela a tabela na cópia de produção:
--
--   access_reviews             rls=t  policies_de_insert=0
--   blog_posts                 rls=t  policies_de_insert=0
--   controles_comentarios      rls=t  policies_de_insert=0
--   denuncias_configuracoes    rls=t  policies_de_insert=0
--   projeto_tarefa_comentarios rls=t  policies_de_insert=0
--   riscos_comentarios         rls=t  policies_de_insert=0
--
-- E o navegador escreve em todas elas:
--
--   src/hooks/useReviewData.tsx:23                    criar revisão de acessos
--   src/components/configuracoes/BlogManager.tsx:103  publicar artigo
--   src/components/controles/ControleDetalheDialog.tsx:242  comentar controlo
--   src/components/denuncia/ConfiguracoesDenuncia.tsx:125   guardar canal de denúncia
--   src/hooks/useProjetoTarefas.tsx:170               comentar tarefa
--   src/components/riscos/RiscoComentarios.tsx:105    comentar risco
--
-- Cada política abaixo espelha a de LEITURA da mesma tabela: quem pode ver,
-- pode escrever. Não é alargamento de permissão — é fechar o buraco entre o que
-- a interface oferece e o que a base aceita.

-- ------------------------------------------------------- revisão de acessos
-- Leitura é por empresa; a criação segue o mesmo âmbito. Apagar continua a
-- exigir administrador, como já exigia.
DROP POLICY IF EXISTS "Usuários criam revisões da própria empresa" ON public.access_reviews;
CREATE POLICY "Usuários criam revisões da própria empresa"
  ON public.access_reviews FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- ------------------------------------------------------------------- blog
-- O blog é a superfície pública do produto e é gerido por super admin — a
-- leitura pública só vê `published = true`, e a escrita fica com quem gere.
DROP POLICY IF EXISTS "Super admin escreve no blog" ON public.blog_posts;
CREATE POLICY "Super admin escreve no blog"
  ON public.blog_posts FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin altera o blog" ON public.blog_posts;
CREATE POLICY "Super admin altera o blog"
  ON public.blog_posts FOR UPDATE
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin apaga do blog" ON public.blog_posts;
CREATE POLICY "Super admin apaga do blog"
  ON public.blog_posts FOR DELETE
  USING (public.is_super_admin());

-- Sem isto, gerir o blog é ler o blog: o ecrã de gestão não veria os rascunhos
-- que ele próprio cria.
DROP POLICY IF EXISTS "Super admin vê rascunhos do blog" ON public.blog_posts;
CREATE POLICY "Super admin vê rascunhos do blog"
  ON public.blog_posts FOR SELECT
  USING (public.is_super_admin());

-- -------------------------------------------------- comentário em controlo
DROP POLICY IF EXISTS "Comentar controlo da própria empresa" ON public.controles_comentarios;
CREATE POLICY "Comentar controlo da própria empresa"
  ON public.controles_comentarios FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.controles c
     WHERE c.id = controles_comentarios.controle_id
       AND c.empresa_id = public.get_user_empresa_id()));

-- ------------------------------------------------ configuração de denúncia
-- Leitura já exige administrador; a escrita segue.
DROP POLICY IF EXISTS "Admin cria configuração de denúncia" ON public.denuncias_configuracoes;
CREATE POLICY "Admin cria configuração de denúncia"
  ON public.denuncias_configuracoes FOR INSERT
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin());

DROP POLICY IF EXISTS "Admin altera configuração de denúncia" ON public.denuncias_configuracoes;
CREATE POLICY "Admin altera configuração de denúncia"
  ON public.denuncias_configuracoes FOR UPDATE
  USING (empresa_id = public.get_user_empresa_id() AND public.is_admin_or_super_admin());

-- ------------------------------------------ comentário em tarefa de projeto
DROP POLICY IF EXISTS "Comentar tarefa a que se tem acesso" ON public.projeto_tarefa_comentarios;
CREATE POLICY "Comentar tarefa a que se tem acesso"
  ON public.projeto_tarefa_comentarios FOR INSERT
  WITH CHECK (public.can_access_tarefa(tarefa_id));

-- ----------------------------------------------------- comentário em risco
DROP POLICY IF EXISTS "Comentar risco da própria empresa" ON public.riscos_comentarios;
CREATE POLICY "Comentar risco da própria empresa"
  ON public.riscos_comentarios FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.riscos r
     WHERE r.id = riscos_comentarios.risco_id
       AND r.empresa_id = public.get_user_empresa_id()));

-- Apagar o próprio comentário. Sem isto, o botão de excluir que o ecrã mostra
-- não faz nada — e um DELETE barrado pela RLS não devolve erro, apenas afeta
-- zero linhas, por isso a interface diria que apagou.
DROP POLICY IF EXISTS "Apagar o próprio comentário de risco" ON public.riscos_comentarios;
CREATE POLICY "Apagar o próprio comentário de risco"
  ON public.riscos_comentarios FOR DELETE
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.riscos r
     WHERE r.id = riscos_comentarios.risco_id
       AND r.empresa_id = public.get_user_empresa_id()));

DROP POLICY IF EXISTS "Apagar o próprio comentário de controlo" ON public.controles_comentarios;
CREATE POLICY "Apagar o próprio comentário de controlo"
  ON public.controles_comentarios FOR DELETE
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.controles c
     WHERE c.id = controles_comentarios.controle_id
       AND c.empresa_id = public.get_user_empresa_id()));
