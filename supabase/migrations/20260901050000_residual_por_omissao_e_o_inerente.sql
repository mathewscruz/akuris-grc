/*
   O risco residual estava por preencher em 63 dos 83 riscos.

   ## O que significa não ter residual

   Nada. E é esse o problema: um risco sem avaliação residual não é um risco
   sem risco residual — é um risco cujo residual ninguém escreveu. A prática
   corrente (ISO 31000, COSO) é a mesma em qualquer ferramenta do género: até
   haver tratamento avaliado, **o residual é igual ao inerente**. Não se ganha
   crédito por controlos que não foram medidos.

   Enquanto ficou nulo, o produto pagou por isso em três sítios:

    · O mapa de calor em modo Residual não desenhava esses riscos — «63 sem
      avaliação residual · não aparecem no mapa». O mapa residual mostrava um
      quarto da carteira.
    · O modo Movimento não tinha seta para eles.
    · O formulário deixa o campo opcional e grava `null` quando fica vazio, por
      isso cada risco novo repunha o buraco.

   ## O que fica

   Duas metades, porque uma só resolvia hoje e não amanhã:

    1. `tg_risco_calcular` passa a preencher o residual com o inerente quando
       ele vem vazio. Vale para o formulário, para a importação, para a API e
       para as funções de borda — todos passam pelo mesmo gatilho.
    2. As 63 linhas existentes recebem o mesmo tratamento.

   ## O que NÃO se faz

   Não se inventa uma avaliação. `tg_risco_registar_no_livro` escreve no
   histórico uma linha «residual» sempre que o residual muda — e o histórico é
   o que desenha a curva de evolução do risco. Um residual que é apenas o valor
   por omissão não é uma avaliação, e pôr 63 pontos no gráfico com a data de
   hoje seria dizer que alguém avaliou 63 riscos hoje.

   Por isso o livro passa a distinguir: residual IGUAL ao inerente, vindo de um
   estado sem residual, é o valor por omissão e não se regista. O número já
   está na linha «inicial», que é escrita na mesma. Qualquer residual que
   DIFIRA do inerente, ou que mude depois, continua a ser registado como
   sempre foi.

   ## Reverter

   `update riscos set probabilidade_residual = null, impacto_residual = null
    where probabilidade_residual = probabilidade_inicial
      and impacto_residual = impacto_inicial;`
   — e repor a versão anterior de `tg_risco_calcular`.
*/

CREATE OR REPLACE FUNCTION public.tg_risco_calcular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ini record;
  v_res record;
BEGIN
  /*
     Sem avaliação residual, o residual é o inerente.

     Ficava nulo, e o mapa de calor em modo Residual deixava de fora 63 dos 83
     riscos — mostrava um quarto da carteira e dizia-o em letra pequena. Até
     haver tratamento avaliado, não se ganha crédito por controlos que não
     foram medidos.
  */
  NEW.probabilidade_residual := COALESCE(NEW.probabilidade_residual, NEW.probabilidade_inicial);
  NEW.impacto_residual       := COALESCE(NEW.impacto_residual, NEW.impacto_inicial);

  SELECT * INTO v_ini FROM public.risco_avaliar(NEW.empresa_id, NEW.probabilidade_inicial, NEW.impacto_inicial);
  SELECT * INTO v_res FROM public.risco_avaliar(NEW.empresa_id, NEW.probabilidade_residual, NEW.impacto_residual);

  NEW.score_inicial       := v_ini.score;
  NEW.nivel_risco_inicial := v_ini.nivel;
  NEW.severidade_inicial  := v_ini.severidade;

  NEW.score_residual       := v_res.score;
  NEW.nivel_risco_residual := v_res.nivel;
  NEW.severidade_residual  := v_res.severidade;

  -- O risco fica sempre preso à matriz vigente da empresa. Antes era um campo
  -- obrigatório no formulário, com uma única opção para escolher.
  SELECT matriz_id INTO NEW.matriz_id FROM public.risco_matriz_vigente(NEW.empresa_id);

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.tg_risco_registar_no_livro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_autor uuid := auth.uid();
  v_por_omissao boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    /*
      A linha que fecha a série.

      `probabilidade`/`impacto` são NOT NULL, por isso guardam-se os últimos
      valores conhecidos — não é o que interessa aqui, mas manter a forma da
      tabela é melhor do que abrir excepções nela.
    */
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      OLD.id,
      OLD.empresa_id,
      COALESCE(OLD.probabilidade_residual, OLD.probabilidade_inicial, 1),
      COALESCE(OLD.impacto_residual, OLD.impacto_inicial, 1),
      COALESCE(OLD.nivel_risco_residual, OLD.nivel_risco_inicial, 'Nao avaliado'),
      'exclusao',
      v_autor
    );
    RETURN OLD;
  END IF;

  -- Avaliação inerente: na criação sempre; na edição só quando muda.
  IF TG_OP = 'INSERT' OR
     NEW.probabilidade_inicial IS DISTINCT FROM OLD.probabilidade_inicial OR
     NEW.impacto_inicial IS DISTINCT FROM OLD.impacto_inicial
  THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      NEW.id, NEW.empresa_id,
      COALESCE(NEW.probabilidade_inicial, 1),
      COALESCE(NEW.impacto_inicial, 1),
      COALESCE(NEW.nivel_risco_inicial, 'Nao avaliado'),
      'inicial', v_autor
    );
  END IF;

  /*
    Valor por omissão não é avaliação.

    `tg_risco_calcular` passou a preencher o residual com o inerente quando
    vem vazio. Sem esta distinção, cada risco novo escreveria no livro uma
    linha «residual» que ninguém avaliou -- e o livro é o que desenha a curva
    de evolução do risco. O número já vai na linha «inicial»; repeti-lo como
    avaliação seria dizer que houve uma.

    Qualquer residual que DIFIRA do inerente, ou que mude depois de existir,
    continua a ser registado como sempre foi.
  */
  v_por_omissao :=
    NEW.probabilidade_residual = NEW.probabilidade_inicial
    AND NEW.impacto_residual = NEW.impacto_inicial
    AND (TG_OP = 'INSERT' OR OLD.probabilidade_residual IS NULL OR OLD.impacto_residual IS NULL);

  IF NEW.probabilidade_residual IS NOT NULL AND NEW.impacto_residual IS NOT NULL
     AND NOT COALESCE(v_por_omissao, false)
     AND (
       TG_OP = 'INSERT' OR
       NEW.probabilidade_residual IS DISTINCT FROM OLD.probabilidade_residual OR
       NEW.impacto_residual IS DISTINCT FROM OLD.impacto_residual
     )
  THEN
    INSERT INTO public.riscos_historico_avaliacoes (
      risco_id, empresa_id, probabilidade, impacto, nivel_risco, tipo, avaliado_por
    ) VALUES (
      NEW.id, NEW.empresa_id,
      NEW.probabilidade_residual,
      NEW.impacto_residual,
      COALESCE(NEW.nivel_risco_residual, NEW.nivel_risco_inicial, 'Nao avaliado'),
      'residual', v_autor
    );
  END IF;

  RETURN NEW;
END
$function$;

/*
   As linhas que já existiam.

   O `UPDATE` toca só nas que estão por preencher, e o próprio
   `tg_risco_calcular` deriva score, nível e severidade residuais a partir dos
   dois campos — não se escreve nenhum deles à mão.

   Um risco sem inerente também não recebe residual: não há de onde o tirar, e
   inventar um seria pior do que deixar vazio.
*/
DO $$
DECLARE
  v_tocados integer;
BEGIN
  UPDATE public.riscos
     SET probabilidade_residual = probabilidade_inicial,
         impacto_residual       = impacto_inicial
   WHERE (probabilidade_residual IS NULL OR impacto_residual IS NULL)
     AND probabilidade_inicial IS NOT NULL
     AND impacto_inicial IS NOT NULL;
  GET DIAGNOSTICS v_tocados = ROW_COUNT;
  RAISE NOTICE 'residual preenchido a partir do inerente em % risco(s)', v_tocados;
END $$;
