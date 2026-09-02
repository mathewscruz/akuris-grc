/*
   A denúncia chegava e ninguém era avisado. Nunca.

   `send-denuncia-notification` — a função que avisa o comité de que entrou uma
   denúncia — começa por ler o caso:

       .from('denuncias')
       .select('*, categoria:denuncias_categorias(nome), empresa:empresas(nome, logo_url)')

   `denuncias` **não tem chave estrangeira para `empresas`**. O PostgREST só
   sabe ligar duas tabelas por chave; sem ela devolve 400 (PGRST200), a
   consulta erra, e a função responde:

       throw new Error('Denúncia não encontrada')

   A denúncia existe. A mensagem é falsa, o handler devolve 500, e com ele
   morre tudo o que vinha a seguir: o aviso no sino, o e-mail, e o
   `console.error` que assinala empresa sem comité. Um canal de denúncia que
   recebe e não avisa é um canal que não existe.

   Só apareceu ao levantar o runtime de borda local e submeter uma denúncia a
   sério, por HTTP. Medido: denúncia criada, protocolo emitido,
   `notifications` com ZERO linhas, e no log
   `Aviso da denúncia falhou: 500 {"error":"Denúncia não encontrada"}`.

   ## Porque escapou à varredura anterior

   `20260901030000_embeds_sem_chave` testou os 51 `select` com embed **do
   cliente** contra a própria API e corrigiu os três que respondiam 400. As
   funções de borda ficaram de fora — e é lá que vive o aviso de uma denúncia.

   ## As irmãs

   As outras duas tabelas do canal têm o mesmo buraco e são embedadas nos
   mesmos sítios. Entram já, para não voltar aqui quando alguém escrever a
   consulta seguinte.

   Cada chave entra `not valid` e é validada a seguir dentro de um bloco que
   apanha a falha: o que a consulta precisa é que a LIGAÇÃO exista — o
   PostgREST lê o catálogo, não o estado de validação. Assim a migração nunca
   aborta por causa de linhas antigas.
*/
DO $$
DECLARE
  v_alvo record;
BEGIN
  FOR v_alvo IN
    SELECT * FROM (VALUES
      ('denuncias',                'denuncias_empresa_id_fkey'),
      ('denuncias_categorias',     'denuncias_categorias_empresa_id_fkey'),
      ('denuncias_configuracoes',  'denuncias_configuracoes_empresa_id_fkey')
    ) AS t(tabela, chave)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = v_alvo.chave) THEN
      RAISE NOTICE '% ja tinha a chave', v_alvo.tabela;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (empresa_id) '
      'REFERENCES public.empresas(id) ON DELETE CASCADE NOT VALID',
      v_alvo.tabela, v_alvo.chave
    );

    BEGIN
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', v_alvo.tabela, v_alvo.chave);
      RAISE NOTICE '% -> chave criada e validada', v_alvo.tabela;
    EXCEPTION WHEN OTHERS THEN
      -- Linhas orfas antigas: a ligacao ja existe (que e o que o PostgREST le)
      -- e o que entrar de novo ja fica travado.
      RAISE NOTICE '% -> chave criada, validacao adiada: %', v_alvo.tabela, SQLERRM;
    END;
  END LOOP;
END $$;
