SELECT set_config('request.jwt.claims','{"sub":"929968a9-886e-4307-82bd-8fd99e94c1ea","role":"authenticated"}', true);

DO $$
DECLARE
  v_empresa uuid := '6c3ebb8f-c182-4006-8252-5c970ad295a6';
  v_user uuid := '929968a9-886e-4307-82bd-8fd99e94c1ea';
  v_cat_risco uuid; v_cat_risco2 uuid; v_matriz uuid;
  v_cat_ctrl uuid; v_cat_doc uuid; v_cat_den uuid;
  v_loc uuid; v_sis uuid; v_forn uuid; v_forn2 uuid;
BEGIN
  INSERT INTO riscos_categorias (nome, descricao, cor, empresa_id) VALUES ('Segurança da Informação','Riscos de SI','#ef4444',v_empresa) RETURNING id INTO v_cat_risco;
  INSERT INTO riscos_categorias (nome, descricao, cor, empresa_id) VALUES ('Compliance & LGPD','Conformidade','#8b5cf6',v_empresa) RETURNING id INTO v_cat_risco2;
  INSERT INTO riscos_matrizes (nome, descricao, empresa_id) VALUES ('Matriz Corporativa Nexure 2026','Matriz principal',v_empresa) RETURNING id INTO v_matriz;
  INSERT INTO controles_categorias (nome, descricao, cor, empresa_id) VALUES ('Segurança da Informação','Controles SI','#3b82f6',v_empresa) RETURNING id INTO v_cat_ctrl;
  INSERT INTO documentos_categorias (nome, descricao, cor, empresa_id) VALUES ('Políticas Corporativas','Políticas','#8b5cf6',v_empresa) RETURNING id INTO v_cat_doc;
  INSERT INTO denuncias_categorias (nome, descricao, cor, empresa_id) VALUES ('Assédio Moral','Denúncias','#ef4444',v_empresa) RETURNING id INTO v_cat_den;
  INSERT INTO ativos_localizacoes (nome, descricao, empresa_id) VALUES ('Datacenter SP','Sala servidores',v_empresa) RETURNING id INTO v_loc;
  INSERT INTO sistemas_privilegiados (nome_sistema, tipo_sistema, criticidade, empresa_id, responsavel_sistema) VALUES ('Active Directory Nexure','Autenticação','critico',v_empresa,'TI') RETURNING id INTO v_sis;

  INSERT INTO fornecedores (nome, cnpj, email, telefone, status, categoria, empresa_id) VALUES ('Microsoft Brasil','04.712.500/0001-07','contato@ms.com','(11)4002-8922','ativo','tecnologia',v_empresa) RETURNING id INTO v_forn;
  INSERT INTO fornecedores (nome, cnpj, email, telefone, status, categoria, empresa_id) VALUES ('AWS Brasil','15.436.940/0001-03','contato@aws.com','(11)3500-0000','ativo','cloud',v_empresa) RETURNING id INTO v_forn2;
  INSERT INTO fornecedores (nome, cnpj, email, status, categoria, empresa_id) VALUES
    ('SecureIT Consultoria','11.222.333/0001-44','contato@secureit.com','ativo','consultoria',v_empresa),
    ('CleanPro Serviços','98.765.432/0001-10','contato@cleanpro.com','ativo','servicos',v_empresa),
    ('TechSupport BR','12.345.678/0001-90','contato@techsup.com','ativo','servicos',v_empresa);

  INSERT INTO riscos (empresa_id, nome, descricao, categoria_id, matriz_id, probabilidade_inicial, impacto_inicial, nivel_risco_inicial, status, responsavel, data_identificacao, created_by) VALUES
    (v_empresa,'Vazamento de Dados de Clientes','Exposição de dados pessoais',v_cat_risco,v_matriz,'provavel','catastrofico','critico','tratado','Mathews Cruz - CISO',CURRENT_DATE-45,v_user),
    (v_empresa,'Ataque Ransomware','Sequestro de dados produção',v_cat_risco,v_matriz,'possivel','catastrofico','critico','monitorado','Mathews Cruz - CISO',CURRENT_DATE-90,v_user),
    (v_empresa,'Falha Backup','Falha procedimento backup',v_cat_risco,v_matriz,'possivel','maior','alto','em_tratamento','TI Operações',CURRENT_DATE-60,v_user),
    (v_empresa,'Acesso Não Autorizado','Tentativas acesso indevido',v_cat_risco,v_matriz,'provavel','maior','alto','tratado','Mathews Cruz - CISO',CURRENT_DATE-30,v_user),
    (v_empresa,'Não Conformidade LGPD','Descumprimento LGPD',v_cat_risco2,v_matriz,'possivel','maior','alto','em_tratamento','DPO',CURRENT_DATE-120,v_user),
    (v_empresa,'Fraude Financeira','Fraude transações',v_cat_risco2,v_matriz,'improvavel','catastrofico','alto','identificado','CFO',CURRENT_DATE-15,v_user),
    (v_empresa,'Phishing Avançado','Campanhas direcionadas',v_cat_risco,v_matriz,'provavel','moderado','medio','monitorado','SOC',CURRENT_DATE-20,v_user),
    (v_empresa,'Insider Threat','Ameaça interna',v_cat_risco,v_matriz,'improvavel','maior','medio','identificado','RH',CURRENT_DATE-10,v_user),
    (v_empresa,'Indisponibilidade Cloud','Falha provedor cloud',v_cat_risco,v_matriz,'possivel','maior','alto','monitorado','TI',CURRENT_DATE-50,v_user),
    (v_empresa,'Shadow IT','Software não autorizado',v_cat_risco,v_matriz,'provavel','moderado','medio','em_tratamento','Mathews Cruz - CISO',CURRENT_DATE-35,v_user);

  INSERT INTO controles (empresa_id, nome, descricao, tipo, categoria_id, status, criticidade, frequencia, responsavel_id) VALUES
    (v_empresa,'MFA Corporativo','MFA obrigatório','preventivo',v_cat_ctrl,'ativo','critico','mensal',v_user),
    (v_empresa,'Backup Diário','Backup incremental','preventivo',v_cat_ctrl,'ativo','critico','semanal',v_user),
    (v_empresa,'SIEM 24x7','Monitoramento contínuo','detectivo',v_cat_ctrl,'ativo','critico','continuo',v_user),
    (v_empresa,'Patch Management','Atualização sistemas','preventivo',v_cat_ctrl,'ativo','alto','mensal',v_user),
    (v_empresa,'Pentest Anual','Teste intrusão externo','detectivo',v_cat_ctrl,'ativo','alto','anual',v_user),
    (v_empresa,'Treinamento SI','Capacitação trimestral','preventivo',v_cat_ctrl,'ativo','medio','trimestral',v_user),
    (v_empresa,'Revisão de Acessos','Recertificação','detectivo',v_cat_ctrl,'ativo','alto','trimestral',v_user),
    (v_empresa,'DLP Endpoint','Prevenção vazamento','preventivo',v_cat_ctrl,'ativo','alto','continuo',v_user),
    (v_empresa,'Segregação Funções','Separação responsabilidades','preventivo',v_cat_ctrl,'ativo','alto','semestral',v_user),
    (v_empresa,'Análise Vulnerabilidades','Scans mensais','detectivo',v_cat_ctrl,'ativo','alto','mensal',v_user);

  INSERT INTO documentos (empresa_id, nome, descricao, tipo, status, classificacao, tags, data_vencimento, created_by) VALUES
    (v_empresa,'Política de Segurança da Informação','Política mestre','politica','ativo','confidencial',ARRAY['seguranca'],CURRENT_DATE+365,v_user),
    (v_empresa,'Política LGPD','Tratamento dados pessoais','politica','ativo','interna',ARRAY['lgpd'],CURRENT_DATE+365,v_user),
    (v_empresa,'Procedimento de Backup','POP backup','procedimento','ativo','interna',ARRAY['backup'],CURRENT_DATE+365,v_user),
    (v_empresa,'Plano de Resposta a Incidentes','IR Plan','procedimento','ativo','confidencial',ARRAY['ir'],CURRENT_DATE+180,v_user),
    (v_empresa,'Termo de Confidencialidade','NDA','contrato','ativo','confidencial',ARRAY['nda'],NULL,v_user),
    (v_empresa,'Política de Controle de Acesso','IAM','politica','ativo','confidencial',ARRAY['iam'],CURRENT_DATE+365,v_user),
    (v_empresa,'Manual do Colaborador','Onboarding','manual','ativo','interna',ARRAY['rh'],CURRENT_DATE+730,v_user),
    (v_empresa,'Política BYOD','Dispositivos pessoais','politica','ativo','interna',ARRAY['mobile'],CURRENT_DATE+365,v_user),
    (v_empresa,'Plano de Continuidade','BCP','procedimento','ativo','confidencial',ARRAY['bcp'],CURRENT_DATE+365,v_user),
    (v_empresa,'Código de Ética','Código corporativo','politica','ativo','publica',ARRAY['etica'],NULL,v_user);

  INSERT INTO incidentes (empresa_id, titulo, descricao, tipo_incidente, criticidade, status, data_ocorrencia, data_deteccao, responsavel_tratamento, created_by) VALUES
    (v_empresa,'Phishing detectado','Campanha bloqueada','seguranca','alta','resolvido',NOW()-INTERVAL '30 days',NOW()-INTERVAL '30 days',v_user,v_user),
    (v_empresa,'Acesso não autorizado','Tentativa IDS','seguranca','critica','em_investigacao',NOW()-INTERVAL '5 days',NOW()-INTERVAL '5 days',v_user,v_user),
    (v_empresa,'Notebook extraviado','Perda em viagem','privacidade','media','contido',NOW()-INTERVAL '15 days',NOW()-INTERVAL '14 days',v_user,v_user),
    (v_empresa,'Indisponibilidade SSO','SSO down 2h','disponibilidade','alta','resolvido',NOW()-INTERVAL '45 days',NOW()-INTERVAL '45 days',v_user,v_user),
    (v_empresa,'Malware estação','AV removeu','seguranca','media','resolvido',NOW()-INTERVAL '60 days',NOW()-INTERVAL '60 days',v_user,v_user),
    (v_empresa,'DDoS portal','Mitigado WAF','disponibilidade','alta','resolvido',NOW()-INTERVAL '75 days',NOW()-INTERVAL '75 days',v_user,v_user);

  INSERT INTO denuncias (empresa_id, token_publico, protocolo, categoria_id, titulo, descricao, status, gravidade, anonima) VALUES
    (v_empresa, replace(gen_random_uuid()::text,'-',''), 'DEN'||to_char(NOW(),'YYYYMMDD')||'1001', v_cat_den,'Conduta inadequada gestor','Relato em reunião','em_analise','alta',true),
    (v_empresa, replace(gen_random_uuid()::text,'-',''), 'DEN'||to_char(NOW(),'YYYYMMDD')||'1002', v_cat_den,'Discriminação','Processo seletivo','em_investigacao','alta',true),
    (v_empresa, replace(gen_random_uuid()::text,'-',''), 'DEN'||to_char(NOW(),'YYYYMMDD')||'1003', v_cat_den,'Uso indevido recursos','Recursos para fins pessoais','resolvida','media',false);

  INSERT INTO ativos (empresa_id, nome, tipo, descricao, proprietario, localizacao, valor_negocio, criticidade, status, data_aquisicao, fornecedor, versao) VALUES
    (v_empresa,'Servidor Aplicação Prod','tecnologia','Dell R740','TI','Datacenter SP','350000','critico','ativo',CURRENT_DATE-730,'Dell','R740'),
    (v_empresa,'Banco PostgreSQL Prod','tecnologia','Cluster PG 15','TI','Datacenter SP','500000','critico','ativo',CURRENT_DATE-365,'PostgreSQL','15.2'),
    (v_empresa,'Firewall FortiGate','tecnologia','Perímetro','TI','Datacenter SP','180000','critico','ativo',CURRENT_DATE-500,'Fortinet','600E'),
    (v_empresa,'Notebook Mathews','tecnologia','Notebook executivo','Mathews Cruz','Escritório','8500','alto','ativo',CURRENT_DATE-200,'Dell','Latitude 7430'),
    (v_empresa,'Switch Core Cisco','tecnologia','Switch core DC','TI','Datacenter SP','95000','critico','ativo',CURRENT_DATE-900,'Cisco','C9300'),
    (v_empresa,'Storage NetApp','tecnologia','Backups','TI','Datacenter SP','280000','critico','ativo',CURRENT_DATE-600,'NetApp','FAS2750'),
    (v_empresa,'Nobreak APC','tecnologia','UPS DC','TI','Datacenter SP','38000','critico','ativo',CURRENT_DATE-800,'APC','SURT10K'),
    (v_empresa,'AC Precision','escritorio','Climatização DC','Facilities','Datacenter SP','45000','alto','ativo',CURRENT_DATE-1000,'Schneider','InRow'),
    (v_empresa,'Impressora HP','escritorio','Multifuncional','Facilities','Escritório','12000','medio','ativo',CURRENT_DATE-400,'HP','M607'),
    (v_empresa,'CRM Salesforce','tecnologia','Licenças CRM','Comercial','Cloud','120000','alto','ativo',CURRENT_DATE-300,'Salesforce','Enterprise');

  INSERT INTO contratos (empresa_id, numero_contrato, nome, tipo, fornecedor_id, valor, data_inicio, data_fim, data_assinatura, status, objeto, created_by) VALUES
    (v_empresa,'CT-2025-001','Licenciamento Microsoft 365','servico',v_forn,180000,CURRENT_DATE-180,CURRENT_DATE+185,CURRENT_DATE-180,'ativo','Licenças M365 E5',v_user),
    (v_empresa,'CT-2025-002','Hospedagem AWS','servico',v_forn2,360000,CURRENT_DATE-365,CURRENT_DATE+365,CURRENT_DATE-365,'ativo','Cloud AWS',v_user),
    (v_empresa,'CT-2025-003','Pentest Anual','consultoria',v_forn,80000,CURRENT_DATE-90,CURRENT_DATE+275,CURRENT_DATE-90,'ativo','Pentest externo',v_user),
    (v_empresa,'CT-2025-004','Limpeza Predial','servico',v_forn2,72000,CURRENT_DATE-120,CURRENT_DATE+245,CURRENT_DATE-120,'ativo','Limpeza',v_user);

  INSERT INTO auditorias (empresa_id, nome, descricao, tipo, status, prioridade, escopo, data_inicio, data_fim_prevista, auditor_responsavel, created_by) VALUES
    (v_empresa,'Auditoria ISO 27001','Auditoria interna SI','interna','em_andamento','alta','SGSI',CURRENT_DATE-30,CURRENT_DATE+30,v_user,v_user),
    (v_empresa,'Auditoria LGPD','Conformidade LGPD','interna','planejada','alta','Dados pessoais',CURRENT_DATE+15,CURRENT_DATE+60,v_user,v_user),
    (v_empresa,'Auditoria Financeira','SOX','externa','concluida','media','Controles financeiros',CURRENT_DATE-180,CURRENT_DATE-90,v_user,v_user);

  INSERT INTO planos_acao (empresa_id, titulo, descricao, status, prioridade, prazo, responsavel_id, created_by, modulo_origem) VALUES
    (v_empresa,'Implementar MFA em todos os sistemas','Rollout MFA','em_andamento','alta',CURRENT_DATE+30,v_user,v_user,'riscos'),
    (v_empresa,'Atualizar Firewall','Upgrade FortiOS','pendente','alta',CURRENT_DATE+45,v_user,v_user,'controles'),
    (v_empresa,'Treinamento LGPD','Capacitação geral','em_andamento','media',CURRENT_DATE+15,v_user,v_user,'riscos'),
    (v_empresa,'Revisar política de senhas','Atualização','concluido','media',CURRENT_DATE-15,v_user,v_user,'auditorias'),
    (v_empresa,'Implantar DLP','Solução DLP endpoints','pendente','alta',CURRENT_DATE+90,v_user,v_user,'incidentes'),
    (v_empresa,'Backup Offsite','Réplica região alternativa','em_andamento','critica',CURRENT_DATE+40,v_user,v_user,'riscos');

  INSERT INTO dados_pessoais (empresa_id, nome, descricao, categoria_dados, tipo_dados, sensibilidade, base_legal, finalidade_tratamento, prazo_retencao) VALUES
    (v_empresa,'Cadastro de Clientes','Dados cadastrais','identificacao','comum','normal','execucao_contrato','Gestão comercial','5 anos'),
    (v_empresa,'Folha de Pagamento','Dados RH','financeiro','comum','sensivel','obrigacao_legal','Pagamentos','10 anos'),
    (v_empresa,'Dados de Saúde Plano','Plano de saúde','saude','sensivel','sensivel','consentimento','Benefícios','5 anos'),
    (v_empresa,'Dados Biométricos Acesso','Biometria','biometrico','sensivel','sensivel','consentimento','Controle acesso','enquanto vínculo');

  INSERT INTO contas_privilegiadas (sistema_id, empresa_id, usuario_beneficiario, email_beneficiario, tipo_acesso, nivel_privilegio, data_concessao, status, justificativa_negocio) VALUES
    (v_sis,v_empresa,'admin-ad','admin-ad@nexure.com.br','permanente','administrador',CURRENT_DATE-365,'ativo','Administração do domínio Active Directory'),
    (v_sis,v_empresa,'svc-backup','svc-backup@nexure.com.br','permanente','servico',CURRENT_DATE-200,'ativo','Service account para rotinas de backup automatizado'),
    (v_sis,v_empresa,'root-prod','root@nexure.com.br','emergencial','administrador',CURRENT_DATE-100,'ativo','Acesso root para administração de servidores produção'),
    (v_sis,v_empresa,'dba-postgres','dba@nexure.com.br','permanente','administrador',CURRENT_DATE-300,'ativo','DBA para administração do cluster PostgreSQL');
END $$;