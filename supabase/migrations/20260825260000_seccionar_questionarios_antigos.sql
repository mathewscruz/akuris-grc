-- Os dois questionários antigos deixam de ser uma parede.
--
-- ## O problema
--
-- «Segurança da Informação» tem 70 perguntas e «Privacidade (LGPD)» tem 30 —
-- e as cem estão todas em `secao = 'Geral'`. Quem responde vê uma lista
-- contínua sem um único ponto de descanso: não sabe onde vai, não sabe quanto
-- falta, e não consegue dizer «deixo a parte de segurança física para o
-- colega». Um fornecedor que abandone a meio recomeça do princípio mentalmente.
--
-- Os três questionários criados depois já nascem agrupados. Estes ficaram para
-- trás porque foram os primeiros.
--
-- ## Como foram agrupados
--
-- Pela ordem que já tinham. As perguntas não estavam baralhadas — estavam
-- ordenadas por assunto e sem etiqueta: as de rede seguidas, as de terceiros
-- seguidas, as de pessoas seguidas. O trabalho aqui foi nomear os blocos que
-- já existiam, não reorganizar nada.
--
-- Por isso os cortes são por `ordem`, e nenhuma pergunta muda de lugar, de
-- peso ou de texto. Quem já respondeu vê exactamente as mesmas perguntas na
-- mesma sequência — agora com títulos pelo meio.

DO $$
DECLARE
  v_seguranca uuid;
  v_privacidade uuid;
  v_afetadas integer;
BEGIN
  SELECT id INTO v_seguranca FROM public.due_diligence_templates
   WHERE nome = 'Segurança da Informação' AND padrao = true LIMIT 1;
  SELECT id INTO v_privacidade FROM public.due_diligence_templates
   WHERE nome = 'Privacidade de Dados (LGPD)' AND padrao = true LIMIT 1;

  -- ── Segurança da Informação: 70 perguntas, 9 blocos ────────────────────
  IF v_seguranca IS NOT NULL THEN
    UPDATE public.due_diligence_questions SET secao = CASE
      WHEN ordem BETWEEN 1  AND 4  THEN 'Governança'            -- política, comité, classificação
      WHEN ordem BETWEEN 5  AND 7  THEN 'Acesso e identidade'   -- acesso, MFA, senhas
      WHEN ordem BETWEEN 8  AND 10 THEN 'Continuidade'          -- backup, teste, plano
      WHEN ordem BETWEEN 11 AND 15 THEN 'Pessoas e incidentes'  -- treino, resposta, registo
      WHEN ordem BETWEEN 16 AND 24 THEN 'Infraestrutura'        -- rede, cifra, vulnerabilidades
      WHEN ordem BETWEEN 25 AND 30 THEN 'Ativos e terceiros'    -- inventário, físico, fornecedores
      WHEN ordem BETWEEN 31 AND 40 THEN 'Conformidade e pessoas'-- auditoria, logs, RH
      WHEN ordem BETWEEN 41 AND 53 THEN 'Nuvem e dados'         -- nuvem, dispositivos, DLP, risco
      ELSE 'Desenvolvimento e maturidade'                       -- 54–70: API, SDLC, melhoria
    END
    WHERE template_id = v_seguranca;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
    RAISE NOTICE 'Segurança da Informação: % perguntas agrupadas em 9 secções', v_afetadas;
  END IF;

  -- ── Privacidade (LGPD): 30 perguntas, 5 blocos ─────────────────────────
  IF v_privacidade IS NOT NULL THEN
    UPDATE public.due_diligence_questions SET secao = CASE
      WHEN ordem BETWEEN 1  AND 4  THEN 'Governança de privacidade'  -- política, DPO, base legal, mapa
      WHEN ordem BETWEEN 5  AND 11 THEN 'Titulares e bases legais'   -- consentimento, direitos, prazos
      WHEN ordem BETWEEN 12 AND 16 THEN 'Ciclo de vida e partilha'   -- retenção, exclusão, operadores
      WHEN ordem BETWEEN 17 AND 22 THEN 'Segurança e incidentes'     -- cifra, acesso, notificação
      ELSE 'Cultura e melhoria'                                      -- 23–30: treino, DPIA, auditoria
    END
    WHERE template_id = v_privacidade;
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
    RAISE NOTICE 'Privacidade (LGPD): % perguntas agrupadas em 5 secções', v_afetadas;
  END IF;

  -- Nenhuma pergunta pode ter ficado sem secção: uma pergunta órfã aparece
  -- num bloco vazio no fim do questionário, o que é pior do que não agrupar.
  IF EXISTS (
    SELECT 1 FROM public.due_diligence_questions
    WHERE template_id IN (v_seguranca, v_privacidade)
      AND (secao IS NULL OR btrim(secao) = '')
  ) THEN
    RAISE WARNING 'há perguntas sem secção depois do agrupamento — verificar';
  END IF;
END $$;
