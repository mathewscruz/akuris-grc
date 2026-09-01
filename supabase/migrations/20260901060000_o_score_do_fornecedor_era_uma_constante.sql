/*
   O score de due diligence era 50. Sempre. Para toda a gente.

   ## A prova

   As 139 perguntas dos cinco modelos são todas `tipo = 'radio'` com opções
   `["Sim","Não"]`. `calculate_due_diligence_score` pontuava assim:

       WHEN q.tipo = 'radio' THEN
         CASE WHEN r.resposta ILIKE '%excelente%' ... THEN 10
              WHEN r.resposta ILIKE '%bom%'      ... THEN 7
              WHEN r.resposta ILIKE '%regular%'  ... THEN 5
              WHEN r.resposta ILIKE '%ruim%'     ... THEN 2
              ELSE 5 END

   Nenhuma das opções do produto casa com nenhum destes padrões. Todas caem no
   `ELSE 5`. Medido na base local, no mesmo questionário:

       tudo "Sim"          -> 50,00
       tudo "Não"          -> 50,00
       texto longo         -> 50,00

   Um fornecedor que responde «Não» a «Política de Segurança da Informação»
   recebe 50/100 e a classificação «regular». O número existe, aparece no
   ecrã, entra no KPI «Score Médio» e no relatório — e não pode variar.

   Os outros dois ramos do cálculo (`booleano` e `numerico`) referem tipos que
   o editor de perguntas NÃO oferece: ele oferece `text`, `textarea`, `select`,
   `radio`, `checkbox`, `file`, `score` e `date`. A função foi escrita contra um
   vocabulário que o produto não usa.

   E `score_breakdown` era o literal `'{}'`: a divisão por secção que o ecrã
   desenha nunca teve nada dentro.

   ## Polaridade: porque não basta «a primeira opção é a melhor»

   Das 39 perguntas interrogativas, **sete** têm o sinal trocado — «Sim» é a
   MÁ resposta:

     · consta de listas restritivas ou de sanções
     · foi autuada por infração laboral nos últimos 24 meses
     · sócios ou administradores condenados por corrupção ou fraude
     · dependência crítica de um único subfornecedor
     · pessoa politicamente exposta no quadro societário
     · acidente de trabalho grave ou fatal nos últimos 24 meses
     · interrupção não planeada superior a 4 horas nos últimos 24 meses

   Um padrão de texto encontrava duas das sete; as outras cinco só aparecem a
   ler as perguntas uma a uma. Por isso a polaridade passa a ser um dado da
   PERGUNTA, declarado em `configuracoes.polaridade`, e não uma adivinhação
   feita a cada submissão.

   As restantes 132 confirmam-se sozinhas: 99 delas já traziam
   `mostrar_evidencia_quando: "Sim"` e `mostrar_justificativa_quando: "Não"` —
   o próprio questionário pede prova a quem responde «Sim» e explicação a quem
   responde «Não».

   ## O que NÃO se pontua

   `text`, `textarea` e `date` ficam FORA da conta, e é uma decisão: pontuar
   texto livre por comprimento — que era o que a função fazia nos outros tipos
   — dá nota alta a quem escreve muito e nota baixa a quem responde bem em duas
   linhas. O texto livre é material para o parecer da IA, que o lê; o score é
   aritmética sobre o que é objectivo. O relatório diz quantas perguntas
   entraram na conta e quantas ficaram de fora.
*/

-- ── polaridade das sete perguntas em que "Sim" é a má resposta ────────────
UPDATE public.due_diligence_questions
   SET configuracoes = COALESCE(configuracoes, '{}'::jsonb) || '{"polaridade":"negativa"}'::jsonb
 WHERE titulo IN (
   'A organização consta de listas restritivas ou de sanções?',
   'A organização foi autuada por infração laboral nos últimos 24 meses?',
   'A organização, sócios ou administradores foram condenados por corrupção ou fraude?',
   'Existe dependência crítica de um único subfornecedor?',
   'Existe pessoa politicamente exposta (PEP) no quadro societário?',
   'Houve acidente de trabalho grave ou fatal nos últimos 24 meses?',
   'Houve interrupção não planeada superior a 4 horas nos últimos 24 meses?'
 );

/**
 * A nota de UMA resposta, de 0 a 10 — ou NULL quando a pergunta não é
 * pontuável.
 *
 * Ordem de decisão:
 *   1. `configuracoes.pontuacoes` — mapa explícito opção → nota. É a saída de
 *      emergência para escalas que a convenção não saiba exprimir.
 *   2. Convenção por tipo, com a polaridade a inverter quando declarada.
 *
 * Devolver NULL não é o mesmo que devolver zero: a pergunta sai da conta em
 * vez de a puxar para baixo.
 */
CREATE OR REPLACE FUNCTION public.dd_nota_da_resposta(
  p_tipo text,
  p_opcoes jsonb,
  p_config jsonb,
  p_resposta text,
  p_arquivo text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_negativa boolean := COALESCE(p_config->>'polaridade', 'positiva') = 'negativa';
  v_explicita numeric;
  v_n integer;
  v_idx integer;
  v_nota numeric;
  v_escolhidas integer;
BEGIN
  IF p_resposta IS NULL OR btrim(p_resposta) = '' THEN
    -- Um anexo pode ser a resposta inteira numa pergunta de ficheiro.
    IF p_tipo = 'file' THEN
      RETURN CASE WHEN COALESCE(btrim(p_arquivo), '') <> '' THEN 10 ELSE 0 END;
    END IF;
    RETURN NULL;
  END IF;

  -- 1. mapa explícito
  BEGIN
    v_explicita := (p_config->'pontuacoes'->>p_resposta)::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_explicita := NULL;
  END;
  IF v_explicita IS NOT NULL THEN
    RETURN GREATEST(0, LEAST(10, v_explicita));
  END IF;

  CASE p_tipo
    WHEN 'radio', 'select' THEN
      v_n := COALESCE(jsonb_array_length(p_opcoes), 0);
      IF v_n < 2 THEN RETURN NULL; END IF;
      SELECT ord - 1 INTO v_idx
        FROM jsonb_array_elements_text(p_opcoes) WITH ORDINALITY AS o(val, ord)
       WHERE o.val = p_resposta
       LIMIT 1;
      -- Resposta fora das opções: não se inventa nota para ela.
      IF v_idx IS NULL THEN RETURN NULL; END IF;
      -- Primeira opção vale 10, última vale 0, o resto distribui-se por igual.
      v_nota := 10.0 * (v_n - 1 - v_idx) / (v_n - 1);

    WHEN 'checkbox' THEN
      v_n := COALESCE(jsonb_array_length(p_opcoes), 0);
      IF v_n = 0 THEN RETURN NULL; END IF;
      SELECT count(*) INTO v_escolhidas
        FROM jsonb_array_elements_text(p_opcoes) AS o(val)
       WHERE p_resposta ILIKE '%' || o.val || '%';
      v_nota := 10.0 * v_escolhidas / v_n;

    WHEN 'score' THEN
      BEGIN
        v_nota := GREATEST(0, LEAST(10, p_resposta::numeric));
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;

    WHEN 'file' THEN
      v_nota := CASE WHEN COALESCE(btrim(p_arquivo), '') <> '' THEN 10 ELSE 0 END;

    ELSE
      /* `text`, `textarea`, `date` e o que vier a seguir: fora da conta.
         Pontuar texto livre por comprimento premeia quem escreve muito. */
      RETURN NULL;
  END CASE;

  RETURN CASE WHEN v_negativa THEN 10 - v_nota ELSE v_nota END;
END;
$function$;

/**
 * O score do fornecedor, e a sua divisão por secção.
 *
 * Grava três coisas, e as três eram inúteis antes:
 *   · `due_diligence_responses.pontuacao` — a nota de cada resposta. O ecrã
 *     desenha-a há muito e ela era sempre NULL.
 *   · `due_diligence_scores.score_breakdown` — a nota por secção. Era `'{}'`.
 *   · `due_diligence_assessments.score_final` — a percentagem, agora capaz de
 *     variar com o que o fornecedor respondeu.
 */
CREATE OR REPLACE FUNCTION public.calculate_due_diligence_score(assessment_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_peso_total numeric := 0;
  v_soma numeric := 0;
  v_score numeric := 0;
  v_classificacao text := 'ruim';
  v_contadas integer := 0;
  v_fora integer := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_nota_registo record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.due_diligence_assessments
     WHERE id = assessment_id_param AND status = 'concluido'
  ) THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou não concluída: %', assessment_id_param;
  END IF;

  -- A nota de cada resposta fica gravada: é o que torna o score conferível.
  UPDATE public.due_diligence_responses r
     SET pontuacao = public.dd_nota_da_resposta(
           q.tipo, q.opcoes, q.configuracoes, r.resposta,
           COALESCE(r.arquivo_url, r.resposta_arquivo_url)
         ),
         updated_at = now()
    FROM public.due_diligence_questions q
   WHERE q.id = r.question_id
     AND r.assessment_id = assessment_id_param;

  SELECT
    COALESCE(sum(r.pontuacao * COALESCE(q.peso, 1)) FILTER (WHERE r.pontuacao IS NOT NULL), 0),
    COALESCE(sum(COALESCE(q.peso, 1))              FILTER (WHERE r.pontuacao IS NOT NULL), 0),
    count(*) FILTER (WHERE r.pontuacao IS NOT NULL),
    count(*) FILTER (WHERE r.pontuacao IS NULL)
    INTO v_soma, v_peso_total, v_contadas, v_fora
    FROM public.due_diligence_responses r
    JOIN public.due_diligence_questions q ON q.id = r.question_id
   WHERE r.assessment_id = assessment_id_param;

  IF v_peso_total > 0 THEN
    v_score := round((v_soma / v_peso_total) * 10, 2);
  END IF;

  IF    v_score >= 80 THEN v_classificacao := 'excelente';
  ELSIF v_score >= 60 THEN v_classificacao := 'bom';
  ELSIF v_score >= 40 THEN v_classificacao := 'regular';
  END IF;

  -- Por secção, com o mesmo peso: é o que o ecrã precisa para dizer ONDE dói.
  FOR v_nota_registo IN
    SELECT COALESCE(NULLIF(btrim(q.secao), ''), 'Geral') AS secao,
           round((sum(r.pontuacao * COALESCE(q.peso, 1)) / NULLIF(sum(COALESCE(q.peso, 1)), 0)) * 10, 2) AS score,
           count(*) AS perguntas
      FROM public.due_diligence_responses r
      JOIN public.due_diligence_questions q ON q.id = r.question_id
     WHERE r.assessment_id = assessment_id_param
       AND r.pontuacao IS NOT NULL
     GROUP BY 1
  LOOP
    v_breakdown := v_breakdown || jsonb_build_object(
      v_nota_registo.secao,
      jsonb_build_object('score', v_nota_registo.score, 'perguntas', v_nota_registo.perguntas)
    );
  END LOOP;

  INSERT INTO public.due_diligence_scores (
    assessment_id, score_total, score_breakdown, classificacao, observacoes_ia, created_at, updated_at
  ) VALUES (
    assessment_id_param, v_score, v_breakdown, v_classificacao,
    /* Cobertura, não parecer. O parecer é da `avaliar-fornecedor-ia`, que lê
       também o texto livre; aqui diz-se apenas sobre o que a conta se fez. */
    format('Cálculo sobre %s pergunta(s) pontuável(is); %s de resposta aberta ficaram fora da conta.', v_contadas, v_fora),
    now(), now()
  )
  ON CONFLICT (assessment_id) DO UPDATE SET
    score_total = EXCLUDED.score_total,
    score_breakdown = EXCLUDED.score_breakdown,
    classificacao = EXCLUDED.classificacao,
    observacoes_ia = EXCLUDED.observacoes_ia,
    updated_at = now();

  UPDATE public.due_diligence_assessments
     SET score_final = v_score, updated_at = now()
   WHERE id = assessment_id_param;
END;
$function$;

/*
   As avaliações que já estavam concluídas.

   Ficaram com o 50 constante gravado em `score_final`, e esse número aparece no
   cartão do fornecedor, no KPI «Score Médio» e no relatório em PDF. Deixá-lo
   seria manter a mentira nas que já existem e corrigi-la só nas próximas.

   Recalcula-se uma a uma, e um erro numa não trava as outras: o objectivo é
   que o máximo possível fique certo, não que a migração falhe por causa de um
   registo estranho.
*/
DO $$
DECLARE
  v_id uuid;
  v_ok integer := 0;
  v_erro integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.due_diligence_assessments WHERE status = 'concluido'
  LOOP
    BEGIN
      PERFORM public.calculate_due_diligence_score(v_id);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erro := v_erro + 1;
      RAISE NOTICE 'score não recalculado para %: %', v_id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'score recalculado em % avaliação(ões); % por tratar', v_ok, v_erro;
END $$;
