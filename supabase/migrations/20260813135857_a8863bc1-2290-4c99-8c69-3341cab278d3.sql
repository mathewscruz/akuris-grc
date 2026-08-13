DO $$
DECLARE
  fw uuid := '79b28dbc-cd8b-40ac-ad48-41a90e6538f9';
  r record;
  data jsonb := '[
["4.1","Understanding the organization and its context"],
["4.2","Understanding the needs and expectations of interested parties"],
["4.3","Determining the scope of the information security management system"],
["4.4","Information security management system"],
["5.1","Leadership and commitment"],
["5.2","Information security policy"],
["5.3","Organizational roles, responsibilities and authorities"],
["6.1.1","General - Actions to address risks and opportunities"],
["6.1.2","Information security risk assessment"],
["6.1.3","Information security risk treatment"],
["6.2","Information security objectives and planning to achieve them"],
["6.3","Planning of changes"],
["7.1","Resources"],
["7.2","Competence"],
["7.3","Awareness"],
["7.4","Communication"],
["7.5","Documented information"],
["8.1","Operational planning and control"],
["8.2","Information security risk assessment"],
["8.3","Information security risk treatment"],
["9.1","Monitoring, measurement, analysis and evaluation"],
["9.2.1","General - Internal audit"],
["9.2.2","Internal audit programme"],
["9.3.1","General - Management review"],
["9.3.2","Management review inputs"],
["9.3.3","Management review results"],
["10.1","Nonconformity and corrective action"],
["10.2","Continual improvement"],
["A.5.1","Policies for information security"],
["A.5.2","Information security roles and responsibilities"],
["A.5.3","Segregation of duties"],
["A.5.4","Management responsibilities"],
["A.5.5","Contact with authorities"],
["A.5.6","Contact with special interest groups"],
["A.5.7","Threat intelligence"],
["A.5.8","Information security in project management"],
["A.5.9","Inventory of information and other associated assets"],
["A.5.10","Acceptable use of information and other associated assets"],
["A.5.11","Return of assets"],
["A.5.12","Classification of information"],
["A.5.13","Labelling of information"],
["A.5.14","Information transfer"],
["A.5.15","Access control"],
["A.5.16","Identity management"],
["A.5.17","Authentication information"],
["A.5.18","Access rights"],
["A.5.19","Information security in supplier relationships"],
["A.5.20","Addressing information security within supplier agreements"],
["A.5.21","Managing information security in the ICT supply chain"],
["A.5.22","Monitoring, review and change management of supplier services"],
["A.5.23","Information security for use of cloud services"],
["A.5.24","Information security incident management planning and preparation"],
["A.5.25","Assessment and decision on information security events"],
["A.5.26","Response to information security incidents"],
["A.5.27","Learning from information security incidents"],
["A.5.28","Collection of evidence"],
["A.5.29","Information security during disruption"],
["A.5.30","ICT readiness for business continuity"],
["A.5.31","Legal, statutory, regulatory and contractual requirements"],
["A.5.32","Intellectual property rights"],
["A.5.33","Protection of records"],
["A.5.34","Privacy and protection of personally identifiable information (PII)"],
["A.5.35","Independent review of information security"],
["A.5.36","Compliance with policies, rules and standards for information security"],
["A.5.37","Documented operating procedures"],
["A.6.1","Screening"],
["A.6.2","Terms and conditions of employment"],
["A.6.3","Information security awareness, education and training"],
["A.6.4","Disciplinary process"],
["A.6.5","Responsibilities after termination or change of employment"],
["A.6.6","Confidentiality or non-disclosure agreements"],
["A.6.7","Remote working"],
["A.6.8","Information security event reporting"],
["A.7.1","Physical security perimeters"],
["A.7.2","Physical entry"],
["A.7.3","Securing offices, rooms and facilities"],
["A.7.4","Physical security monitoring"],
["A.7.5","Protecting against physical and environmental threats"],
["A.7.6","Working in secure areas"],
["A.7.7","Clear desk and clear screen"],
["A.7.8","Equipment siting and protection"],
["A.7.9","Security of assets off-premises"],
["A.7.10","Storage media"],
["A.7.11","Supporting utilities"],
["A.7.12","Cabling security"],
["A.7.13","Equipment maintenance"],
["A.7.14","Secure disposal or re-use of equipment"],
["A.8.1","User end point devices"],
["A.8.2","Privileged access rights"],
["A.8.3","Information access restriction"],
["A.8.4","Access to source code"],
["A.8.5","Secure authentication"],
["A.8.6","Capacity management"],
["A.8.7","Protection against malware"],
["A.8.8","Management of technical vulnerabilities"],
["A.8.9","Configuration management"],
["A.8.10","Information deletion"],
["A.8.11","Data masking"],
["A.8.12","Data leakage prevention"],
["A.8.13","Information backup"],
["A.8.14","Redundancy of information processing facilities"],
["A.8.15","Logging"],
["A.8.16","Monitoring activities"],
["A.8.17","Clock synchronization"],
["A.8.18","Use of privileged utility programs"],
["A.8.19","Installation of software on operational systems"],
["A.8.20","Networks security"],
["A.8.21","Security of network services"],
["A.8.22","Segregation of networks"],
["A.8.23","Web filtering"],
["A.8.24","Use of cryptography"],
["A.8.25","Secure development life cycle"],
["A.8.26","Application security requirements"],
["A.8.27","Secure system architecture and engineering principles"],
["A.8.28","Secure coding"],
["A.8.29","Security testing in development and acceptance"],
["A.8.30","Outsourced development"],
["A.8.31","Separation of development, test and production environments"],
["A.8.32","Change management"],
["A.8.33","Test information"],
["A.8.34","Protection of information systems during audit testing"]
]'::jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(data) AS e(v) LOOP
    UPDATE public.gap_analysis_requirements
       SET titulo_en = r.v->>1
     WHERE framework_id = fw AND codigo = r.v->>0;
  END LOOP;

  UPDATE public.gap_analysis_requirements
     SET categoria_en = CASE categoria
        WHEN 'Contexto' THEN 'Context'
        WHEN 'Liderança' THEN 'Leadership'
        WHEN 'Planejamento' THEN 'Planning'
        WHEN 'Apoio' THEN 'Support'
        WHEN 'Operação' THEN 'Operation'
        WHEN 'Avaliação' THEN 'Performance Evaluation'
        WHEN 'Melhoria' THEN 'Improvement'
        WHEN 'Segurança' THEN 'Organizational Controls'
        WHEN 'Pessoas' THEN 'People Controls'
        WHEN 'Físico' THEN 'Physical Controls'
        WHEN 'Tecnologia' THEN 'Technological Controls'
        ELSE categoria END
   WHERE framework_id = fw;
END $$;

UPDATE public.gap_analysis_frameworks
   SET nome_en = 'ISO/IEC 27001:2022',
       descricao_en = 'International standard for information security management systems (ISMS), including Annex A controls'
 WHERE id = '79b28dbc-cd8b-40ac-ad48-41a90e6538f9';