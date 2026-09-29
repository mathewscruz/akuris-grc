BEGIN;
SET LOCAL lock_timeout='5s';
-- Additional, role-specific readiness checks. Never assign manufacturer-only
-- engineering duties to an importer/distributor solely because it sells a product.
DO $$ DECLARE v uuid; f uuid:='a8c1f2d4-2929-4292-8292-000000002847'; row record; req uuid; domain_id uuid; control uuid;
BEGIN
  SELECT id INTO STRICT v FROM public.regulatory_framework_versions WHERE framework_id=f AND version='2024.2847-readiness-draft.1';
  FOR row IN SELECT * FROM (VALUES
    ('CRA-IMP-001','importer','conformity-readiness','AK-CONF-001','Verificação antes da colocação no mercado','Pre-market verification','Art. 19(1)-(2)',
     'O importador verifica avaliação de conformidade, documentação técnica, marcação CE e informações exigidas antes de colocar o produto no mercado?',
     'Does the importer verify conformity assessment, technical documentation, CE marking and required information before placing the product on the market?',
     'Defina um checklist por produto/versão. Registre as verificações com o fabricante, declaração de conformidade e instruções. Pendências impedem a liberação até revisão.',
     'Define a product/version checklist. Record manufacturer checks, declaration of conformity and instructions. Hold release while unresolved issues require review.'),
    ('CRA-IMP-002','importer','product-security-documentation','AK-DOC-001','Identificação, guarda e cooperação do importador','Importer identification, retention and cooperation','Art. 19(3), (6)-(8)',
     'O importador mantém identificação e contatos, documentação acessível, cooperação com autoridades e contingência para encerramento do fabricante?',
     'Does the importer maintain identification and contact details, accessible documentation, authority cooperation and a process for manufacturer cessation?',
     'Identifique o importador nas informações do produto. Preserve a declaração e acesso à documentação pelo prazo aplicável. Defina como responder às autoridades e informar a cessação do fabricante.',
     'Identify the importer in product information. Retain the declaration and access to documentation for the applicable period. Define authority response and manufacturer cessation procedures.'),
    ('CRA-IMP-003','importer','incident-management','AK-IR-001','Correção e escalonamento de riscos pelo importador','Importer corrective action and risk escalation','Art. 19(4)-(5)',
     'Existem rotinas para comunicar vulnerabilidades, corrigir não conformidade, retirar ou recolher produtos e informar riscos significativos?',
     'Are there procedures to communicate vulnerabilities, correct non-conformity, withdraw or recall products and communicate significant risks?',
     'Mantenha contato com o fabricante e responsáveis por retirada/recolhimento. Teste o encaminhamento de riscos e preserve registros das medidas tomadas.',
     'Maintain manufacturer contacts and withdrawal/recall ownership. Exercise risk escalation and retain records of corrective measures.'),
    ('CRA-DIS-001','distributor','conformity-readiness','AK-CONF-001','Diligência antes da distribuição','Pre-distribution due diligence','Art. 20(1)-(2)',
     'O distribuidor verifica marcação CE, identificação, instruções e informações de suporte exigidas antes da disponibilização?',
     'Does the distributor verify CE marking, identification, instructions and required support information before making the product available?',
     'Crie uma verificação documentada de entrada por produto e fornecedor. Registre exceções e suspenda a disponibilização quando houver motivo para acreditar em não conformidade.',
     'Create a documented incoming-product and supplier check. Record exceptions and suspend availability when there is reason to believe the product is non-conforming.'),
    ('CRA-DIS-002','distributor','incident-management','AK-IR-001','Correção e cooperação do distribuidor','Distributor corrective action and cooperation','Art. 20(3)-(5)',
     'O distribuidor consegue escalar vulnerabilidades, promover correções, retirada/recolhimento e cooperar com autoridades?',
     'Can the distributor escalate vulnerabilities, support correction, withdrawal/recall and cooperate with authorities?',
     'Documente o fluxo com fabricante e importador, responsáveis, informações às autoridades e rastreabilidade de produtos afetados. Teste com cenário de risco significativo.',
     'Document the manufacturer/importer workflow, ownership, authority communications and affected-product traceability. Exercise a significant-risk scenario.'),
    ('CRA-REP-001','authorised_representative','governance','AK-GOV-001','Mandato do representante autorizado','Authorised representative mandate','Art. 18',
     'Existe mandato escrito que define tarefas permitidas, conservação de documentos e cooperação, sem transferir obrigações indelegáveis do fabricante?',
     'Is there a written mandate defining permitted tasks, document retention and cooperation without transferring non-delegable manufacturer duties?',
     'Revise o mandato e seus limites com o fabricante. Registre a declaração/documentação disponível e os procedimentos de atendimento e cooperação com autoridades.',
     'Review the mandate and its limits with the manufacturer. Record available declarations/documentation and authority response/cooperation procedures.'),
    ('CRA-TRACE-001','all','supply-chain-security','AK-SC-001','Rastreabilidade de operadores econômicos','Economic operator traceability','Art. 23',
     'É possível identificar fornecedores e destinatários profissionais do produto durante o período exigido?',
     'Can upstream and downstream economic operators be identified for the required period?',
     'Relacione produto/versão aos operadores que forneceram ou receberam o produto. Mantenha retenção e consulta de registros para solicitações das autoridades.',
     'Relate product/version to supplying and receiving economic operators. Maintain retention and record retrieval for authority requests.'),
    ('CRA-CNF-002','manufacturer','conformity-readiness','AK-CONF-001','Rota de avaliação para produto importante ou crítico','Assessment route for important or critical products','Arts. 7, 8, 32; Annexes III-IV',
     'A rota de avaliação de conformidade da classe foi revisada, incluindo normas/especificações, organismo notificado ou esquema aplicável e eventuais exceções?',
     'Has the class-specific conformity assessment route been reviewed, including standards/specifications, notified bodies or applicable schemes and any exceptions?',
     'Fundamente a função principal nas descrições técnicas vigentes. Revise a rota do artigo 32 e, para críticos, os atos/esquemas aplicáveis. Não presuma certificação ou autoavaliação permitida sem verificar condições.',
     'Substantiate core functionality against current technical descriptions. Review Article 32 and, for critical products, applicable acts/schemes. Do not assume certification or permitted self-assessment without checking conditions.')
  ) x(code,role,domain,control,title,title_en,legal,question,question_en,guidance,guidance_en) LOOP
    req:=md5(v::text||':'||row.code)::uuid;
    SELECT id INTO STRICT domain_id FROM public.regulatory_domains WHERE framework_version_id=v AND code=row.domain;
    SELECT id INTO STRICT control FROM public.universal_controls WHERE code=row.control;
    INSERT INTO public.gap_analysis_requirements(id,framework_id,codigo,titulo,titulo_en,descricao,descricao_en,categoria,categoria_en,peso,ordem,obrigatorio,orientacao_implementacao,orientacao_implementacao_en,exemplos_evidencias,exemplos_evidencias_en)
    VALUES(req,f,row.code,row.title,row.title_en,row.question,row.question_en,row.domain,row.domain,3,100,true,row.guidance,row.guidance_en,
      'Procedimento aprovado; registros de execução e revisão; responsáveis; registros do produto e versão.',
      'Approved procedure; execution and review records; accountable owners; product and version records.') ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.regulatory_requirement_definitions(requirement_id,framework_version_id,domain_id,legal_reference,source_url,assessment_question,assessment_question_en,applicability_rule,criticality,risk_level,remediation_guidance,remediation_guidance_en)
    VALUES(req,v,domain_id,row.legal,'https://eur-lex.europa.eu/eli/reg/2024/2847/oj',row.question,row.question_en,
      jsonb_build_object('version',1,'kind','human_review_required','roles',CASE WHEN row.role='all' THEN to_jsonb(ARRAY['manufacturer','importer','distributor','authorised_representative']) ELSE to_jsonb(ARRAY[row.role]) END,
        'categories',CASE WHEN row.code='CRA-CNF-002' THEN to_jsonb(ARRAY['important_class_i','important_class_ii','critical','review_required']) ELSE to_jsonb(ARRAY['default','important_class_i','important_class_ii','critical','review_required']) END,
        'note','Role-specific baseline; review applicability and exceptions against the legal source.'),'high','high',row.guidance,row.guidance_en) ON CONFLICT(requirement_id) DO NOTHING;
    INSERT INTO public.control_framework_mappings(control_id,requirement_id,framework_version_id,mapping_strength,mapping_notes,source_url)
      VALUES(control,req,v,'partial','Shared capability supports only the stated role-specific readiness obligation; it is not an equivalence or compliance decision.','https://eur-lex.europa.eu/eli/reg/2024/2847/oj') ON CONFLICT(control_id,requirement_id) DO NOTHING;
  END LOOP;
END $$;

-- Deliberately narrow, inspectable crosswalks against catalog identities, not
-- keyword matching. Keep draft until a reviewer confirms scope for each reuse.
INSERT INTO public.control_framework_mappings(control_id,requirement_id,mapping_strength,mapping_notes,source_url,review_status)
SELECT c.id,r.id,'supporting',m.note,m.source,'draft'
FROM (VALUES
 ('AK-VM-001','ISO/IEC 27001','A.8.8','Vulnerability identification and remediation records may support organizational technical-vulnerability management. Product scope, execution and full clause coverage require separate review.','https://www.iso.org/standard/27001'),
 ('AK-VM-001','NIST CSF','ID.RA-01','Product vulnerability inventories may support vulnerability identification. Organizational scope and validation remain independent; no automatic equivalence.','https://doi.org/10.6028/NIST.CSWP.29'),
 ('AK-SDL-001','NIS2','Art. 21(2)(e)','Secure development and vulnerability handling practices may support acquisition/development/maintenance measures; entity scope and legal obligations differ.','https://eur-lex.europa.eu/eli/dir/2022/2555/oj'),
 ('AK-IR-001','DORA','DORA-IR-01','Product incident processes may provide supporting records for ICT incident management. Financial-entity scope, classifications and reporting are not inherited.','https://eur-lex.europa.eu/eli/reg/2022/2554/oj'),
 ('AK-IR-001','SOC 2 Type II','CC7.4','Incident-response execution records may support the incident-response criterion only after scope and review-period verification. No audit opinion or equivalence is implied.','https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022')
) m(control,framework,code,note,source)
JOIN public.universal_controls c ON c.code=m.control
JOIN public.gap_analysis_frameworks f ON f.nome=m.framework AND f.empresa_id IS NULL AND f.is_template
JOIN public.gap_analysis_requirements r ON r.framework_id=f.id AND r.codigo=m.code
ON CONFLICT(control_id,requirement_id) DO NOTHING;
COMMIT;
