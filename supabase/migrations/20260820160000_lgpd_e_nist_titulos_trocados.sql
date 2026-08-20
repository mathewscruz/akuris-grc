-- Títulos e textos trocados: a LGPD perguntava duas vezes a mesma coisa e o
-- NIST trazia texto da versão 1.1 debaixo de um código da 2.0.
--
-- A equalização de 20/08 acertou as LISTAS DE CÓDIGOS. Não olhou para o texto
-- de cada requisito, e a guarda `catalogo-bate-com-a-norma` também não —
-- compara códigos, não prosa. Estes seis apareceram ao montar o cruzamento
-- entre frameworks, onde é preciso saber do que cada requisito trata.
--
-- ================================ LGPD (Lei 13.709/2018) ================
--
--  * Art. 40 tinha, palavra por palavra, o TEXTO DO ART. 48 (comunicação de
--    incidente). Duas linhas do catálogo faziam a mesma pergunta, e a
--    obrigação real do art. 40 — padrões de interoperabilidade e tempo de
--    guarda — nunca era perguntada.
--
--  * Art. 47 estava intitulado "Comunicação de Incidente"; o seu texto (certo)
--    é a garantia de segurança que se mantém MESMO APÓS o término do
--    tratamento. Quem procurava a obrigação de notificar caía aqui.
--
--  * Art. 48 estava intitulado "Prazo de Conservação"; o seu texto (certo) é
--    justamente a comunicação do incidente à ANPD e ao titular. O título mais
--    procurado do capítulo de segurança estava no artigo errado — e o certo
--    escondido sob um nome que não tem nada a ver.
--
--  * Art. 38 chamava-se "Autoridade Nacional", um nome que não diz o que se
--    tem de fazer. O artigo é o do relatório de impacto (RIPD).
--
--  * Art. 55-L chamava-se "Relatório de Impacto" e o texto é o das receitas da
--    ANPD. Dois artigos disputavam o mesmo nome.
--
-- ================================ NIST CSF 2.0 =========================
--
--  * PR.DS-11 na CSF 2.0 é "Backups of data are created, protected,
--    maintained, and tested". O catálogo tinha "Gestão de Capacidade" — que é
--    o PR.DS-4 da CSF **1.1**, retirado na 2.0. Cópia de segurança, um dos
--    controlos mais básicos que existe, não era perguntada em lado nenhum do
--    NIST.
--
--  * PR.DS-10 na 2.0 é a protecção dos dados EM USO. O catálogo trazia a
--    verificação de integridade, que é o PR.DS-6 da 1.1.
--
-- Só o título e a descrição mudam. Nenhum código entra ou sai, portanto
-- nenhuma avaliação, SoA ou evidência é afectada.

DO $$
DECLARE
  v_lgpd uuid;
  v_nist uuid;
BEGIN
  SELECT id INTO v_lgpd FROM public.gap_analysis_frameworks
   WHERE nome = 'LGPD' AND empresa_id IS NULL LIMIT 1;
  SELECT id INTO v_nist FROM public.gap_analysis_frameworks
   WHERE nome = 'NIST CSF' AND empresa_id IS NULL LIMIT 1;

  -- ------------------------------------------------------------------ LGPD
  IF v_lgpd IS NOT NULL THEN
    UPDATE public.gap_analysis_requirements SET
      titulo = 'Padrões de Interoperabilidade e Tempo de Guarda',
      descricao = 'A autoridade nacional poderá dispor sobre padrões de interoperabilidade para fins de portabilidade, livre acesso aos dados e segurança, assim como sobre o tempo de guarda dos registros, tendo em vista especialmente a necessidade e a transparência.'
     WHERE framework_id = v_lgpd AND codigo = 'Art. 40';

    UPDATE public.gap_analysis_requirements SET
      titulo = 'Segurança Mesmo Após o Término do Tratamento'
     WHERE framework_id = v_lgpd AND codigo = 'Art. 47';

    UPDATE public.gap_analysis_requirements SET
      titulo = 'Comunicação de Incidente de Segurança'
     WHERE framework_id = v_lgpd AND codigo = 'Art. 48';

    UPDATE public.gap_analysis_requirements SET
      titulo = 'Relatório de Impacto à Proteção de Dados (RIPD)'
     WHERE framework_id = v_lgpd AND codigo = 'Art. 38';

    UPDATE public.gap_analysis_requirements SET
      titulo = 'Receitas da ANPD'
     WHERE framework_id = v_lgpd AND codigo = 'Art. 55-L';
  END IF;

  -- ------------------------------------------------------------------ NIST
  IF v_nist IS NOT NULL THEN
    UPDATE public.gap_analysis_requirements SET
      titulo = 'Cópias de Segurança',
      descricao = 'As cópias de segurança dos dados são criadas, protegidas, mantidas e testadas.'
     WHERE framework_id = v_nist AND codigo = 'PR.DS-11';

    UPDATE public.gap_analysis_requirements SET
      titulo = 'Proteção dos Dados em Uso',
      descricao = 'A confidencialidade, a integridade e a disponibilidade dos dados em uso são protegidas.'
     WHERE framework_id = v_nist AND codigo = 'PR.DS-10';
  END IF;
END $$;
