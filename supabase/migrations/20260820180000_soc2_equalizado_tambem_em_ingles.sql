-- Os 18 requisitos que a equalização do SOC 2 acrescentou entram também em inglês.
--
-- A migration `20260820130000` fechou o catálogo do SOC 2 na norma publicada:
-- tirou 20 códigos que não existem e pôs 18 que faltavam, entre eles a série
-- CC9 inteira. Só que os pôs em português. O SOC 2 ficou com 43 de 61
-- requisitos traduzidos — e o SOC 2 é, dos frameworks do catálogo, o que mais
-- provavelmente é lido em inglês, porque o relatório vai para o cliente
-- americano que o exigiu.
--
-- O texto em inglês é o dos Trust Services Criteria (TSP Section 100, 2017
-- com revisões de 2022), que é a língua original do critério — a coluna
-- portuguesa é que é a tradução.

DO $$
DECLARE
  v_fw uuid;
  v_faltam int;
BEGIN
  SELECT id INTO v_fw FROM public.gap_analysis_frameworks
   WHERE nome = 'SOC 2 Type II' AND empresa_id IS NULL LIMIT 1;

  IF v_fw IS NULL THEN
    RAISE WARNING 'SOC 2 Type II nao encontrado; nada a fazer';
    RETURN;
  END IF;

  UPDATE public.gap_analysis_requirements r SET
    titulo_en    = t.titulo_en,
    descricao_en = t.titulo_en,
    categoria_en = t.categoria_en
  FROM (VALUES
    ('CC3.4', 'Identification and assessment of changes that could significantly impact internal control (COSO Principle 9)', 'Risk Assessment'),
    ('CC5.3', 'Deployment of control activities through policies and procedures (COSO Principle 12)', 'Control Activities'),
    ('CC6.4', 'Physical access to facilities and protected information assets is restricted to authorized personnel', 'Access Controls'),
    ('CC6.5', 'Protections over physical assets are discontinued only after data and software have been rendered unreadable', 'Access Controls'),
    ('CC6.6', 'Logical access security measures protect against threats from sources outside the system boundaries', 'Access Controls'),
    ('CC6.7', 'Transmission, movement and removal of information is restricted to authorized users and protected', 'Access Controls'),
    ('CC6.8', 'Controls prevent or detect and act upon the introduction of unauthorized or malicious software', 'Access Controls'),
    ('CC7.3', 'Security events are evaluated to determine whether they constitute a security incident', 'System Operations'),
    ('CC7.4', 'Identified security incidents are responded to through a defined incident response program', 'System Operations'),
    ('CC7.5', 'Recovery activities are performed following identified security incidents', 'System Operations'),
    ('CC9.1', 'Risk mitigation activities are identified and developed for risks arising from potential business disruptions', 'Risk Mitigation'),
    ('CC9.2', 'Risks associated with vendors and business partners are assessed and managed', 'Risk Mitigation'),
    ('P4.3',  'Personal information is securely disposed of to meet the entity''s objectives', 'Privacy'),
    ('P6.3',  'A complete, accurate and timely record of unauthorized disclosures, including breaches, is maintained', 'Privacy'),
    ('P6.4',  'Privacy commitments are obtained from vendors and third parties and their compliance is periodically assessed', 'Privacy'),
    ('P6.5',  'Third parties notify the entity of actual or suspected unauthorized disclosures and the entity acts under its incident response program', 'Privacy'),
    ('P6.6',  'Affected data subjects, regulators and others are notified of breaches and incidents', 'Privacy'),
    ('P6.7',  'On request, an accounting of the personal information held and disclosed is provided to the data subject', 'Privacy')
  ) AS t(codigo, titulo_en, categoria_en)
  WHERE r.framework_id = v_fw
    AND r.codigo = t.codigo
    AND r.titulo_en IS NULL;

  -- A conta tem de fechar: 61 requisitos, 61 traduzidos.
  SELECT count(*) INTO v_faltam
    FROM public.gap_analysis_requirements
   WHERE framework_id = v_fw AND titulo_en IS NULL;

  IF v_faltam > 0 THEN
    RAISE WARNING 'SOC 2: ainda ha % requisitos sem titulo_en', v_faltam;
  END IF;
END $$;
