-- SOC 2 e NIST CSF passam a ter os requisitos que a norma publicada pede.
--
-- Uma auditoria encontrou erro dos DOIS lados do catálogo, e as contagens
-- batiam porque os erros se anulavam. Confirmado depois contra fonte primária,
-- com segunda conferência independente:
--
--   SOC 2  — PDF red-lined da 2017 TSC publicado pela AICPA, com os "TSP Ref. #"
--            enumerados do texto extraído, cruzado com o crosswalk oficial do
--            NIST Privacy Framework. 61 critérios: 33 CC (CC1.1 a CC9.2),
--            3 A1, 2 C1, 5 PI1, 18 P.
--   CSF    — export oficial do NIST CSF 2.0 Reference Tool. 185 linhas de
--            subcategoria, 79 marcadas [Withdrawn], 106 activas:
--            GV 31, ID 21, PR 22, DE 11, RS 13, RC 8.
--
-- O QUE SAI
-- No SOC 2, vinte códigos que não existem em norma nenhuma. A Disponibilidade
-- real é só A1.1 a A1.3 — o catálogo tinha até A5.1. A Confidencialidade é só
-- C1.1 e C1.2, a Integridade de Processamento só PI1.1 a PI1.5, e a Privacidade
-- acaba em P8.1. O P9.1 é resíduo de numeração antiga e aparece até no
-- crosswalk do NIST, que é uma fonte respeitável e nisto está errada.
-- No CSF, doze subcategorias da 1.1 que o NIST retirou na 2.0, mais PR.DS-09,
-- que não existe em versão nenhuma.
--
-- O QUE ENTRA
-- Dezoito critérios reais do SOC 2 que nunca eram perguntados, incluindo a
-- série CC9 INTEIRA — CC9.2 é gestão de fornecedores, hoje o item mais
-- escrutinado num SOC 2, e a empresa nunca era questionada sobre ele. Mais
-- CC6.4 a CC6.8 (acesso físico e lógico), CC7.3 a CC7.5 (resposta a incidente)
-- e P6.3 a P6.7 (notificação de violação ao titular e ao regulador). No CSF,
-- RC.RP-02 e RS.AN-08.
--
-- E A TAXONOMIA, QUE ESTAVA DESLOCADA EM UM
-- Os rótulos de categoria dos Common Criteria não correspondiam aos grupos da
-- AICPA: CC2 estava marcado "Gestão de Riscos" quando é Comunicação e
-- Informação, CC3 "Atividades de Controle" quando é Avaliação de Riscos, e CC4
-- e CC5 estavam trocados entre si. Ficam pelos grupos reais.
--
-- Nenhum dos 32 requisitos removidos tem avaliação, declaração de
-- aplicabilidade ou evidência ligada — verificado antes de escrever isto, e a
-- migration volta a verificar antes de apagar.

DO $$
DECLARE
  v_soc2 uuid;
  v_nist uuid;
  v_total int;
BEGIN
  SELECT id INTO v_soc2 FROM public.gap_analysis_frameworks
   WHERE nome = 'SOC 2 Type II' AND empresa_id IS NULL LIMIT 1;
  SELECT id INTO v_nist FROM public.gap_analysis_frameworks
   WHERE nome = 'NIST CSF' AND empresa_id IS NULL LIMIT 1;


  -- ---------------------------------------------- SOC 2: os grupos reais
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Ambiente de Controle'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC1.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Comunicação e Informação'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC2.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Avaliação de Riscos'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC3.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Monitoramento'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC4.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Atividades de Controle'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC5.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Controles de Acesso'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC6.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Operação de Sistemas'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC7.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Gestão de Mudanças'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC8.%';
  UPDATE public.gap_analysis_requirements
     SET categoria = 'Mitigação de Riscos'
   WHERE framework_id = v_soc2 AND codigo LIKE 'CC9.%';

  -- ---------------------------------------------- o que sai
  DELETE FROM public.gap_analysis_requirements r
   WHERE r.framework_id = v_soc2
     AND r.codigo IN ('A2.1', 'A2.2', 'A3.1', 'A3.2', 'A4.1', 'A4.2', 'A5.1', 'C2.1', 'C2.2', 'C3.1', 'C3.2', 'C4.1', 'C4.2', 'P8.2', 'P9.1', 'PI2.1', 'PI2.2', 'PI3.1', 'PI3.2', 'PI4.1')
     -- Só sai o que ninguém tocou. Um requisito com trabalho feito em cima
     -- fica, e passa a ser decisão de quem o avaliou.
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_soa s WHERE s.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.evidence_library_links l WHERE l.requirement_id = r.id);
  DELETE FROM public.gap_analysis_requirements r
   WHERE r.framework_id = v_nist
     AND r.codigo IN ('DE.CM-04', 'DE.CM-05', 'DE.CM-07', 'DE.CM-08', 'PR.DS-05', 'PR.DS-06', 'PR.DS-07', 'PR.DS-08', 'PR.DS-09', 'RC.CO-01', 'RS.AN-01', 'RS.AN-04')
     -- Só sai o que ninguém tocou. Um requisito com trabalho feito em cima
     -- fica, e passa a ser decisão de quem o avaliou.
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_soa s WHERE s.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.evidence_library_links l WHERE l.requirement_id = r.id);

  -- ---------------------------------------------- o que entra
  INSERT INTO public.gap_analysis_requirements
    (framework_id, codigo, titulo, descricao, categoria, peso, obrigatorio)
  VALUES
    (v_soc2, 'CC3.4', 'Identificação e avaliação de mudanças significativas (COSO Princípio 9)', 'Identificação e avaliação de mudanças significativas (COSO Princípio 9)', 'Avaliação de Riscos', 3, true),
    (v_soc2, 'CC5.3', 'Implantação de atividades de controle por meio de políticas e procedimentos (COSO Princípio 12)', 'Implantação de atividades de controle por meio de políticas e procedimentos (COSO Princípio 12)', 'Atividades de Controle', 3, true),
    (v_soc2, 'CC6.4', 'Restrição do acesso físico a instalações e ativos de informação protegidos', 'Restrição do acesso físico a instalações e ativos de informação protegidos', 'Controles de Acesso', 3, true),
    (v_soc2, 'CC6.5', 'Descontinuação de proteções sobre ativos físicos só após inutilizar dados e software', 'Descontinuação de proteções sobre ativos físicos só após inutilizar dados e software', 'Controles de Acesso', 3, true),
    (v_soc2, 'CC6.6', 'Medidas de acesso lógico contra ameaças externas às fronteiras do sistema', 'Medidas de acesso lógico contra ameaças externas às fronteiras do sistema', 'Controles de Acesso', 3, true),
    (v_soc2, 'CC6.7', 'Restrição e proteção da transmissão, movimentação e remoção de informação', 'Restrição e proteção da transmissão, movimentação e remoção de informação', 'Controles de Acesso', 3, true),
    (v_soc2, 'CC6.8', 'Prevenção ou detecção e resposta à introdução de software não autorizado ou malicioso', 'Prevenção ou detecção e resposta à introdução de software não autorizado ou malicioso', 'Controles de Acesso', 3, true),
    (v_soc2, 'CC7.3', 'Avaliação de eventos de segurança e determinação de incidentes', 'Avaliação de eventos de segurança e determinação de incidentes', 'Operação de Sistemas', 3, true),
    (v_soc2, 'CC7.4', 'Resposta a incidentes de segurança por programa definido de resposta a incidentes', 'Resposta a incidentes de segurança por programa definido de resposta a incidentes', 'Operação de Sistemas', 3, true),
    (v_soc2, 'CC7.5', 'Atividades de recuperação após incidentes de segurança identificados', 'Atividades de recuperação após incidentes de segurança identificados', 'Operação de Sistemas', 3, true),
    (v_soc2, 'CC9.1', 'Atividades de mitigação de riscos decorrentes de potenciais interrupções do negócio', 'Atividades de mitigação de riscos decorrentes de potenciais interrupções do negócio', 'Mitigação de Riscos', 3, true),
    (v_soc2, 'CC9.2', 'Avaliação e gestão de riscos associados a fornecedores e parceiros de negócio', 'Avaliação e gestão de riscos associados a fornecedores e parceiros de negócio', 'Mitigação de Riscos', 3, true),
    (v_soc2, 'P4.3', 'Descarte seguro de dados pessoais', 'Descarte seguro de dados pessoais', 'Privacy', 3, true),
    (v_soc2, 'P6.3', 'Registro completo, exato e tempestivo das divulgações não autorizadas, incluindo violações', 'Registro completo, exato e tempestivo das divulgações não autorizadas, incluindo violações', 'Privacy', 3, true),
    (v_soc2, 'P6.4', 'Compromissos de privacidade obtidos de fornecedores e terceiros, com avaliação periódica', 'Compromissos de privacidade obtidos de fornecedores e terceiros, com avaliação periódica', 'Privacy', 3, true),
    (v_soc2, 'P6.5', 'Notificação pelo terceiro de divulgação não autorizada, real ou suspeita, e ação conforme resposta a incidentes', 'Notificação pelo terceiro de divulgação não autorizada, real ou suspeita, e ação conforme resposta a incidentes', 'Privacy', 3, true),
    (v_soc2, 'P6.6', 'Notificação de violações e incidentes a titulares afetados, reguladores e outros', 'Notificação de violações e incidentes a titulares afetados, reguladores e outros', 'Privacy', 3, true),
    (v_soc2, 'P6.7', 'Prestação de contas ao titular sobre dados pessoais detidos e divulgados, mediante pedido', 'Prestação de contas ao titular sobre dados pessoais detidos e divulgados, mediante pedido', 'Privacy', 3, true)
  ON CONFLICT (framework_id, codigo) WHERE codigo IS NOT NULL DO NOTHING;

  INSERT INTO public.gap_analysis_requirements
    (framework_id, codigo, titulo, descricao, categoria, peso, obrigatorio)
  VALUES
    (v_nist, 'RC.RP-02', 'Recovery actions are selected, scoped, prioritized, and performed', 'Recovery actions are selected, scoped, prioritized, and performed', 'Execução da Recuperação', 3, true),
    (v_nist, 'RS.AN-08', 'An incident''s magnitude is estimated and validated', 'An incident''s magnitude is estimated and validated', 'Análise de Incidentes', 3, true)
  ON CONFLICT (framework_id, codigo) WHERE codigo IS NOT NULL DO NOTHING;

  -- ---------------------------------------------- a conta tem de fechar
  SELECT count(*) INTO v_total FROM public.gap_analysis_requirements WHERE framework_id = v_soc2;
  IF v_total <> 61 THEN
    RAISE WARNING 'SOC 2 ficou com % requisitos, a norma tem 61', v_total;
  END IF;
  SELECT count(*) INTO v_total FROM public.gap_analysis_requirements WHERE framework_id = v_nist;
  IF v_total <> 106 THEN
    RAISE WARNING 'NIST CSF ficou com % subcategorias, a 2.0 tem 106', v_total;
  END IF;
END $$;
