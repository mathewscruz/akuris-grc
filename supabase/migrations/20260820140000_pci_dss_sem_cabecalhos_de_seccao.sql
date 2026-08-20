-- O PCI DSS deixa de perguntar cabeçalhos de secção.
--
-- O catálogo tinha 288 requisitos. A norma não tem 288.
--
-- A regra está na Figura 5 do próprio padrão, "Understanding the Parts of the
-- Requirements": o nível X.X é uma **Requirement Description** — organiza e
-- descreve os requisitos que ficam por baixo dela. Não tem bloco "Defined
-- Approach Requirements" nem procedimentos de teste, e no ROC não tem sequer
-- coluna de avaliação. Só do nível X.X.X para baixo é que existe requisito
-- testável.
--
-- Os 39 códigos de dois níveis semeados — 1.1, 1.2, 10.1, 3.4 e companhia —
-- são exactamente essas descrições. Estavam a ser perguntados ao cliente como
-- se fossem controlos, e ainda por cima sem critério: entraram os do Requisito
-- 1 ao 11, e os do 12 ficaram de fora.
--
-- Verificado contra o texto integral da v4.0.1 (junho de 2024), lido em PDF:
--
--   Requisitos 1 a 12, no papel ...... 250
--     R1=19  R2=11  R3=29  R4=6   R5=13  R6=19
--     R7=12  R8=29  R9=27  R10=27 R11=21 R12=37
--   Menos três já substituídos ....... 247  (ver adiante)
--   Apêndices A1/A2/A3 ............... 30
--
-- Os apêndices NÃO são semeados, e é deliberado. Os três são condicionais: A1
-- só se aplica a provedor multi-inquilino, A2 só a quem ainda usa SSL ou TLS
-- antigo em terminais POI, e A3 só a entidade designada por uma bandeira ou
-- pelo adquirente. Semeá-los faria toda a gente responder ao que não lhe diz
-- respeito. Pertencem ao assistente de escopo, quando o PCI DSS tiver um.
--
-- Duas correcções pontuais que a verificação apanhou, e que valem registar:
--
--   * o 3.1.2 faltava. Todos os Requisitos de 1 a 11 têm o seu X.1.2 de papéis
--     e responsabilidades; o 3 era o único sem. (No Requisito 12 o equivalente
--     é o 12.1.3 — o 12.1.2 é a revisão anual da política, e está certo.)
--
--   * o 9.5.1.2.1 EXISTE, página 233, e define por análise de risco a
--     frequência de inspecção dos terminais POI. Um levantamento anterior
--     dizia que não existia; a base estava certa e ficou.
--
-- E a versão: a v4.0 foi retirada em 31/12/2024 e a vigente é a v4.0.1. A
-- numeração não mudou entre as duas, portanto é só o rótulo.

DO $$
DECLARE
  v_fw uuid;
  v_total int;
BEGIN
  SELECT id INTO v_fw FROM public.gap_analysis_frameworks
   WHERE nome = 'PCI DSS' AND empresa_id IS NULL LIMIT 1;

  IF v_fw IS NULL THEN
    RAISE WARNING 'PCI DSS nao encontrado; nada a fazer';
    RETURN;
  END IF;

  -- ---------------------------------------------------- fora os cabeçalhos
  DELETE FROM public.gap_analysis_requirements r
   WHERE r.framework_id = v_fw
     -- Dois níveis exactos: 1.1 sai, 1.1.1 fica.
     AND array_length(string_to_array(r.codigo, '.'), 1) = 2
     -- Só sai o que ninguém tocou.
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_soa s WHERE s.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.evidence_library_links l WHERE l.requirement_id = r.id);

  -- ---------------------------------------------------- dentro o que faltava
  INSERT INTO public.gap_analysis_requirements
    (framework_id, codigo, titulo, descricao, categoria, peso, obrigatorio)
  VALUES
    (v_fw, '3.1.2',
     'Papéis e responsabilidades para o Req 3',
     'Os papéis e responsabilidades para executar as atividades do Requisito 3 estão documentados, atribuídos e compreendidos.',
     'Data Protection', 3, true)
  ON CONFLICT (framework_id, codigo) WHERE codigo IS NOT NULL DO NOTHING;

  -- --------------------------------------- fora os três já substituídos
  /*
    Substituídos em 31 de março de 2025, com a nota de aplicabilidade a
    dizê-lo por extenso no próprio padrão:

      6.4.1  "will be superseded by Requirement 6.4.2 after 31 March 2025"
      8.3.10 "will be superseded by Requirement 8.3.10.1 once it becomes
              effective"; e o 8.3.10.1 acrescenta: "Until this requirement is
              effective on 31 March 2025, service providers may meet EITHER
              Requirement 8.3.10 or 8.3.10.1"
      10.7.1 "will be superseded by Requirement 10.7.2 as of 31 March 2025"

    Os sucessores já estão no catálogo. Manter os antigos faz o cliente
    responder duas vezes ao mesmo controlo — e, nos três casos, a versão antiga
    é MAIS FRACA que a nova: dava para responder "conforme" numa e "não
    conforme" na outra sobre a mesma coisa. O 6.4.1 admitia revisão manual onde
    o 6.4.2 exige solução automatizada; o 8.3.10 pedia só orientação ao cliente
    onde o 8.3.10.1 exige controlo técnico; o 10.7.1 valia só para provedor de
    serviço onde o 10.7.2 vale para todos e cobre mais dois sistemas.

    Uma varredura do documento inteiro por "supersede" e "replace Requirement"
    devolve exactamente estas três notas nos Requisitos 1 a 12. Não há uma
    quarta. E o único prazo que existe na v4.0.1 é 31/03/2025, portanto não há
    nenhum requisito ainda em carência hoje.
  */
  DELETE FROM public.gap_analysis_requirements r
   WHERE r.framework_id = v_fw
     AND r.codigo IN ('6.4.1', '8.3.10', '10.7.1')
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_evaluations e WHERE e.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.gap_analysis_soa s WHERE s.requirement_id = r.id)
     AND NOT EXISTS (SELECT 1 FROM public.evidence_library_links l WHERE l.requirement_id = r.id);

  -- ---------------------------------------------------- a versão vigente
  UPDATE public.gap_analysis_frameworks
     SET versao = '4.0.1'
   WHERE id = v_fw AND versao = '4.0';

  -- ---------------------------------------------------- a conta tem de fechar
  SELECT count(*) INTO v_total FROM public.gap_analysis_requirements WHERE framework_id = v_fw;
  IF v_total <> 247 THEN
    RAISE WARNING 'PCI DSS ficou com % requisitos, esperava 247 (250 no papel menos os 3 substituidos)', v_total;
  END IF;
END $$;
