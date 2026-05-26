
DO $$
DECLARE
  v_emp uuid := '34b992d1-47bc-4bc1-bf39-df83d20e60fe';
  v_user uuid := '665e71d9-a3ef-49d2-adfa-10e73c631bbf';
  v_cat_risco uuid; v_matriz uuid; v_cat_ctrl uuid; v_cat_doc uuid;
  v_cat_den uuid; v_sis uuid; v_forn uuid;
  v_aud uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text, 'role','authenticated')::text, true);

  -- Categorias base (idempotente)
  SELECT id INTO v_cat_risco FROM riscos_categorias WHERE empresa_id=v_emp LIMIT 1;
  IF v_cat_risco IS NULL THEN
    INSERT INTO riscos_categorias(nome,descricao,cor,empresa_id) VALUES ('Segurança da Informação','Riscos cibernéticos','#ef4444',v_emp) RETURNING id INTO v_cat_risco;
  END IF;

  SELECT id INTO v_matriz FROM riscos_matrizes WHERE empresa_id=v_emp LIMIT 1;
  IF v_matriz IS NULL THEN
    INSERT INTO riscos_matrizes(nome,descricao,empresa_id,ativo) VALUES ('Matriz Corporativa 2025','Matriz principal',v_emp,true) RETURNING id INTO v_matriz;
  END IF;

  SELECT id INTO v_cat_ctrl FROM controles_categorias WHERE empresa_id=v_emp LIMIT 1;
  IF v_cat_ctrl IS NULL THEN
    INSERT INTO controles_categorias(nome,descricao,cor,empresa_id) VALUES ('Segurança da Informação','Controles de SI','#3b82f6',v_emp) RETURNING id INTO v_cat_ctrl;
  END IF;

  SELECT id INTO v_cat_doc FROM documentos_categorias WHERE empresa_id=v_emp LIMIT 1;
  IF v_cat_doc IS NULL THEN
    INSERT INTO documentos_categorias(nome,descricao,cor,empresa_id) VALUES ('Políticas','Políticas','#8b5cf6',v_emp) RETURNING id INTO v_cat_doc;
  END IF;

  SELECT id INTO v_cat_den FROM denuncias_categorias WHERE empresa_id=v_emp LIMIT 1;
  IF v_cat_den IS NULL THEN
    INSERT INTO denuncias_categorias(nome,descricao,cor,empresa_id) VALUES ('Conduta','Casos de conduta','#ef4444',v_emp) RETURNING id INTO v_cat_den;
  END IF;

  -- RISCOS (+9)
  INSERT INTO riscos(empresa_id,nome,descricao,categoria_id,matriz_id,probabilidade_inicial,impacto_inicial,nivel_risco_inicial,status,responsavel,data_identificacao,created_by) VALUES
    (v_emp,'Vazamento de Dados de Clientes','Exposição de PII por ataque externo',v_cat_risco,v_matriz,'provavel','catastrofico','critico','tratado','João Silva - CISO',CURRENT_DATE-45,v_user),
    (v_emp,'Falha no Backup','Falha em rotina diária de backup',v_cat_risco,v_matriz,'possivel','maior','alto','monitorado','Carlos - TI',CURRENT_DATE-60,v_user),
    (v_emp,'Acesso Não Autorizado','Tentativa de acesso a sistemas críticos',v_cat_risco,v_matriz,'provavel','maior','alto','em_tratamento','João Silva',CURRENT_DATE-30,v_user),
    (v_emp,'Fraude Financeira','Risco de fraude em transações',v_cat_risco,v_matriz,'improvavel','catastrofico','alto','identificado','Maria - CFO',CURRENT_DATE-15,v_user),
    (v_emp,'Não Conformidade LGPD','Descumprimento de bases legais',v_cat_risco,v_matriz,'possivel','maior','alto','em_tratamento','Ana - DPO',CURRENT_DATE-90,v_user),
    (v_emp,'Ataque Ransomware','Sequestro de dados produtivos',v_cat_risco,v_matriz,'possivel','catastrofico','critico','monitorado','João - CISO',CURRENT_DATE-120,v_user),
    (v_emp,'Perda de Ativos Físicos','Furto de notebooks',v_cat_risco,v_matriz,'possivel','moderado','medio','identificado','Pedro - Facilities',CURRENT_DATE-20,v_user),
    (v_emp,'Indisponibilidade SaaS','Queda de fornecedor crítico',v_cat_risco,v_matriz,'possivel','maior','alto','monitorado','Carlos - TI',CURRENT_DATE-10,v_user),
    (v_emp,'Engenharia Social','Phishing direcionado a executivos',v_cat_risco,v_matriz,'provavel','maior','alto','em_tratamento','João - CISO',CURRENT_DATE-5,v_user);

  -- CONTROLES (+8)
  INSERT INTO controles(empresa_id,nome,descricao,tipo,categoria_id,status,criticidade,frequencia,responsavel_backup,created_at) VALUES
    (v_emp,'Controle de Acesso Lógico','Gestão de permissões e MFA','preventivo',v_cat_ctrl,'ativo','critico','mensal','João - CISO',now()),
    (v_emp,'Backup Automático Diário','Backup com restore mensal','preventivo',v_cat_ctrl,'ativo','critico','semanal','Carlos - TI',now()),
    (v_emp,'Revisão de Logs','Análise diária de logs','detectivo',v_cat_ctrl,'ativo','alto','diario','João - CISO',now()),
    (v_emp,'Segregação de Funções','Separação de responsabilidades','preventivo',v_cat_ctrl,'ativo','alto','mensal','Maria - CFO',now()),
    (v_emp,'Monitoramento Firewall','Monitoramento 24x7','detectivo',v_cat_ctrl,'ativo','critico','diario','SOC',now()),
    (v_emp,'Scan de Vulnerabilidades','Varredura mensal','detectivo',v_cat_ctrl,'ativo','alto','mensal','Carlos - TI',now()),
    (v_emp,'Treinamento de Segurança','Capacitação trimestral','preventivo',v_cat_ctrl,'ativo','medio','trimestral','RH',now()),
    (v_emp,'Gestão de Patches','Aplicação mensal de patches','preventivo',v_cat_ctrl,'ativo','alto','mensal','Carlos - TI',now());

  -- DOCUMENTOS (+6)
  INSERT INTO documentos(empresa_id,nome,descricao,tipo,status,created_by) VALUES
    (v_emp,'Política de Segurança da Informação','Política corporativa','politica','ativo',v_user),
    (v_emp,'Manual LGPD','Boas práticas LGPD','manual','ativo',v_user),
    (v_emp,'Procedimento de Backup','POP backup','procedimento','ativo',v_user),
    (v_emp,'Política de Acesso','Normas de acesso','politica','ativo',v_user),
    (v_emp,'Plano de Resposta a Incidentes','Resposta a incidentes','procedimento','ativo',v_user),
    (v_emp,'Política de Mesa Limpa','Mesa e tela limpa','politica','ativo',v_user);

  -- ATIVOS (+11)
  INSERT INTO ativos(empresa_id,nome,tipo,descricao,proprietario,localizacao,criticidade,status,fornecedor,versao) VALUES
    (v_emp,'Servidor Aplicação Principal','tecnologia','Dell R740','TI','Datacenter','critico','ativo','Dell','R740'),
    (v_emp,'Banco de Dados PostgreSQL','tecnologia','Cluster PG15','TI','Datacenter','critico','ativo','PostgreSQL','15.2'),
    (v_emp,'Firewall FortiGate','tecnologia','Firewall perímetro','TI','Datacenter','critico','ativo','Fortinet','600E'),
    (v_emp,'Notebook CEO','tecnologia','Latitude 5420','João - CEO','Escritório','alto','ativo','Dell','5420'),
    (v_emp,'Notebook CFO','tecnologia','Latitude 5420','Maria - CFO','Escritório','alto','ativo','Dell','5420'),
    (v_emp,'Switch Core Cisco','tecnologia','Switch core DC','TI','Datacenter','critico','ativo','Cisco','C9300'),
    (v_emp,'Storage NetApp','tecnologia','Storage de backup','TI','Datacenter','critico','ativo','NetApp','FAS2750'),
    (v_emp,'Impressora HP','escritorio','Multifuncional','Facilities','Escritório','medio','ativo','HP','M607'),
    (v_emp,'Nobreak APC','tecnologia','UPS DC','TI','Datacenter','critico','ativo','APC','SURT10K'),
    (v_emp,'Office 365','tecnologia','Suíte de produtividade','TI','Cloud','alto','ativo','Microsoft','E3'),
    (v_emp,'AWS Production','tecnologia','Conta produtiva AWS','TI','Cloud','critico','ativo','AWS','—');

  -- INCIDENTES (+5)
  INSERT INTO incidentes(empresa_id,titulo,descricao,tipo_incidente,criticidade,status,data_ocorrencia,data_deteccao,created_by) VALUES
    (v_emp,'Tentativa de Phishing','Campanha bloqueada','seguranca','alta','resolvido',now()-interval '30 days',now()-interval '30 days',v_user),
    (v_emp,'Acesso Suspeito a Servidor','IDS detectou tentativa','seguranca','critica','em_investigacao',now()-interval '5 days',now()-interval '5 days',v_user),
    (v_emp,'Perda de Notebook','Colaborador reportou perda','privacidade','media','contido',now()-interval '15 days',now()-interval '14 days',v_user),
    (v_emp,'Indisponibilidade SSO','SSO indisponível 2h','disponibilidade','alta','resolvido',now()-interval '45 days',now()-interval '45 days',v_user),
    (v_emp,'Malware em Estação','Antivírus removeu','seguranca','media','resolvido',now()-interval '60 days',now()-interval '60 days',v_user);

  -- FORNECEDORES (+4)
  INSERT INTO fornecedores(empresa_id,nome,cnpj,email,telefone,endereco,status,categoria) VALUES
    (v_emp,'Microsoft Brasil','04.712.500/0001-07','contato@microsoft.com.br','(11) 4002-8922','São Paulo','ativo','tecnologia'),
    (v_emp,'TechSupport Consultoria','12.345.678/0001-90','contato@techsupport.com.br','(11) 3456-7890','São Paulo','ativo','servicos'),
    (v_emp,'SecureIT','11.222.333/0001-44','contato@secureit.com.br','(11) 4567-8901','Rio de Janeiro','ativo','consultoria'),
    (v_emp,'AWS Brasil','01.234.567/0001-89','aws@amazon.com','(11) 5000-0000','São Paulo','ativo','tecnologia');

  SELECT id INTO v_forn FROM fornecedores WHERE empresa_id=v_emp AND nome='Microsoft Brasil' LIMIT 1;

  -- CONTRATOS (+3)
  INSERT INTO contratos(empresa_id,fornecedor_id,numero_contrato,nome,tipo,status,valor,data_inicio,data_fim,objeto,created_by) VALUES
    (v_emp,v_forn,'CTR-2025-001','Licenciamento M365','servico','ativo',180000,CURRENT_DATE-200,CURRENT_DATE+165,'Licenças Microsoft 365 E3',v_user),
    (v_emp,v_forn,'CTR-2025-002','Suporte Técnico','servico','ativo',96000,CURRENT_DATE-100,CURRENT_DATE+265,'Suporte premier 8x5',v_user),
    (v_emp,v_forn,'CTR-2025-003','Cloud AWS','servico','ativo',420000,CURRENT_DATE-300,CURRENT_DATE+65,'Infraestrutura AWS',v_user);

  -- DADOS PESSOAIS LGPD (+5)
  INSERT INTO dados_pessoais(empresa_id,nome,descricao,categoria_dados,tipo_dados,sensibilidade,finalidade_tratamento,base_legal,created_by) VALUES
    (v_emp,'Cadastro de Clientes','Dados cadastrais de clientes PF','identificacao','nome,cpf,email,telefone','comum','Execução de contrato','contrato',v_user),
    (v_emp,'Folha de Pagamento','Dados de colaboradores','financeiro','cpf,salario,conta_bancaria','comum','Obrigação legal','obrigacao_legal',v_user),
    (v_emp,'Recrutamento','CVs de candidatos','identificacao','nome,email,historico','comum','Processo seletivo','consentimento',v_user),
    (v_emp,'Saúde Ocupacional','Atestados e exames','saude','exames,atestados','sensivel','Medicina do trabalho','obrigacao_legal',v_user),
    (v_emp,'Marketing','Base de leads','identificacao','nome,email','comum','Comunicação','legitimo_interesse',v_user);

  -- DENUNCIAS (+3) - status válido
  INSERT INTO denuncias(empresa_id,token_publico,protocolo,categoria_id,titulo,descricao,gravidade,status,anonima,politica_aceita) VALUES
    (v_emp,encode(gen_random_bytes(16),'hex'),'DEN'||to_char(now(),'YYYYMMDD')||'0001',v_cat_den,'Suspeita de conflito de interesses','Gestor com vínculo com fornecedor','alta','em_investigacao',true,true),
    (v_emp,encode(gen_random_bytes(16),'hex'),'DEN'||to_char(now(),'YYYYMMDD')||'0002',v_cat_den,'Assédio moral','Relato de comportamento abusivo','critica','em_analise',true,true),
    (v_emp,encode(gen_random_bytes(16),'hex'),'DEN'||to_char(now(),'YYYYMMDD')||'0003',v_cat_den,'Uso indevido de recursos','Uso de e-mail para fins pessoais','media','resolvida',false,true);

  -- AUDITORIAS + ITENS (+3 com itens)
  INSERT INTO auditorias(empresa_id,nome,descricao,tipo,status,prioridade,framework,data_inicio,data_fim_prevista,escopo,objetivos,created_by) VALUES
    (v_emp,'Auditoria Interna ISO 27001 Q1/2026','Revisão anual de SGSI','interna','em_execucao','alta','ISO 27001',CURRENT_DATE-30,CURRENT_DATE+30,'Todos os domínios','Avaliar conformidade',v_user)
    RETURNING id INTO v_aud;
  INSERT INTO auditoria_itens(auditoria_id,codigo,titulo,descricao,status,prioridade,created_by) VALUES
    (v_aud,'A.5.1','Políticas de Segurança','Verificar políticas vigentes','pendente','alta',v_user),
    (v_aud,'A.8.1','Inventário de Ativos','Validar inventário','em_andamento','media',v_user),
    (v_aud,'A.9.2','Gestão de Acessos','Revisar processo de provisionamento','pendente','alta',v_user),
    (v_aud,'A.12.3','Backup','Validar rotinas e restores','concluido','critica',v_user);

  INSERT INTO auditorias(empresa_id,nome,tipo,status,prioridade,framework,created_by) VALUES
    (v_emp,'Auditoria LGPD 2025','interna','planejamento','alta','LGPD',v_user),
    (v_emp,'Auditoria Externa SOC 2','externa','concluida','critica','SOC 2',v_user);

  -- SISTEMAS PRIVILEGIADOS (+3)
  INSERT INTO sistemas_privilegiados(empresa_id,nome_sistema,tipo_sistema,criticidade,responsavel_sistema,categoria,ativo) VALUES
    (v_emp,'Active Directory','autenticacao','critico','Carlos - TI','infraestrutura',true),
    (v_emp,'AWS Console','cloud','critico','Carlos - TI','cloud',true),
    (v_emp,'SAP ERP','erp','critico','Maria - CFO','negocio',true);

  SELECT id INTO v_sis FROM sistemas_privilegiados WHERE empresa_id=v_emp AND nome_sistema='Active Directory' LIMIT 1;

  -- CONTAS PRIVILEGIADAS (+3)
  INSERT INTO contas_privilegiadas(empresa_id,sistema_id,usuario_beneficiario,email_beneficiario,tipo_acesso,nivel_privilegio,data_concessao,data_expiracao,status,justificativa_negocio,created_by) VALUES
    (v_emp,v_sis,'Carlos Santos','carlos@nexure.com.br','permanente','admin',CURRENT_DATE-180,CURRENT_DATE+185,'ativo','Administração de domínio',v_user),
    (v_emp,v_sis,'João Silva','joao@nexure.com.br','temporario','admin',CURRENT_DATE-30,CURRENT_DATE+60,'ativo','Projeto de migração AD',v_user),
    (v_emp,v_sis,'Pedro Lima','pedro@nexure.com.br','emergencial','leitura',CURRENT_DATE-5,CURRENT_DATE+25,'ativo','Acesso break-glass auditoria',v_user);

  -- PLANOS DE AÇÃO (+5)
  INSERT INTO planos_acao(empresa_id,titulo,descricao,status,prioridade,prazo,modulo_origem,created_by) VALUES
    (v_emp,'Implantar MFA em todos os sistemas','MFA obrigatório corporativo','em_andamento','alta',CURRENT_DATE+30,'controles',v_user),
    (v_emp,'Revisar políticas LGPD','Atualização anual de políticas','pendente','media',CURRENT_DATE+60,'documentos',v_user),
    (v_emp,'Tratamento risco ransomware','EDR + backup imutável','em_andamento','critica',CURRENT_DATE+45,'riscos',v_user),
    (v_emp,'Plano remediação findings auditoria','Endereçar findings ISO','pendente','alta',CURRENT_DATE+90,'auditorias',v_user),
    (v_emp,'Renovação contrato AWS','Renegociar contrato AWS','pendente','media',CURRENT_DATE+65,'contratos',v_user);

END $$;
