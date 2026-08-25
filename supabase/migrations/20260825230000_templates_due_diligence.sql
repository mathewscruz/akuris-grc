-- Mais três questionários de due diligence, prontos a enviar.
--
-- ## Porquê
--
-- Havia dois: Segurança da Informação e Privacidade (LGPD). Cobrem o risco
-- técnico e o de dados — e deixam de fora três domínios pelos quais um
-- fornecedor derruba um cliente com a mesma facilidade: parar de operar,
-- corromper, e explorar quem trabalha para ele.
--
-- Estes três não são variações dos que já existem. Cada um pergunta algo que
-- os outros não perguntam, e por isso podem ser enviados em conjunto sem
-- repetir o fornecedor.
--
-- ## Duas escolhas de desenho
--
-- **Secções a sério.** Os dois templates existentes têm as ~100 perguntas todas
-- em `secao = 'Geral'` — quem responde vê uma parede. Estes vêm agrupados por
-- assunto, que é o que permite responder em blocos e retomar mais tarde.
--
-- **O peso diz o que importa.** Peso 5 fica reservado ao que, sozinho,
-- desqualifica: não ter plano de continuidade testado, não ter canal de
-- denúncia, usar trabalho forçado. Peso 1 é contexto. Sem esta diferença, o
-- score trata «tem política escrita» como igual a «já teve incidente grave».

DO $$
DECLARE
  v_empresa_padrao uuid := '00000000-0000-0000-0000-000000000000';
  v_template uuid;
BEGIN

  -- ══════════════════════════════════════════════════════════════════════
  -- 1. Continuidade de Negócio e Resiliência
  -- ══════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.due_diligence_templates WHERE nome = 'Continuidade de Negócio' AND padrao = true) THEN
    INSERT INTO public.due_diligence_templates (empresa_id, nome, descricao, categoria, ativo, padrao, versao)
    VALUES (v_empresa_padrao, 'Continuidade de Negócio',
            'Avalia se o fornecedor consegue continuar a servir quando algo corre mal — e em quanto tempo. Indicado para quem sustenta um processo que não pode parar.',
            'Continuidade', true, true, 1)
    RETURNING id INTO v_template;

    INSERT INTO public.due_diligence_questions (template_id, titulo, descricao, tipo, opcoes, obrigatoria, peso, ordem, secao) VALUES
    (v_template, 'Existe plano de continuidade de negócio documentado?', 'Um plano escrito, aprovado e com dono identificado.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 1, 'Plano'),
    (v_template, 'O plano foi testado nos últimos 12 meses?', 'Teste real ou simulação com registo de resultados. Plano nunca testado é papel.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 2, 'Plano'),
    (v_template, 'Existe RTO e RPO definidos para os serviços que nos prestam?', 'Tempo máximo de paragem e perda máxima de dados aceitáveis.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 3, 'Plano'),
    (v_template, 'Há um responsável designado para acionar o plano?', 'Com substituto identificado.', 'radio', '["Sim","Não"]'::jsonb, true, 3, 4, 'Plano'),

    (v_template, 'As cópias de segurança são testadas por restauro?', 'Fazer backup e conseguir restaurar são coisas diferentes.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 5, 'Recuperação'),
    (v_template, 'Existe local alternativo de operação?', 'Site secundário, nuvem ou teletrabalho estruturado.', 'radio', '["Sim","Não"]'::jsonb, true, 3, 6, 'Recuperação'),
    (v_template, 'Os dados estão replicados em região geográfica distinta?', NULL, 'radio', '["Sim","Não"]'::jsonb, false, 2, 7, 'Recuperação'),

    (v_template, 'Existe dependência crítica de um único subfornecedor?', 'Um elo único é um ponto de falha que herdamos.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 8, 'Dependências'),
    (v_template, 'Os subfornecedores críticos são avaliados quanto a continuidade?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 9, 'Dependências'),
    (v_template, 'Existe seguro que cubra interrupção de operação?', NULL, 'radio', '["Sim","Não"]'::jsonb, false, 2, 10, 'Dependências'),

    (v_template, 'Houve interrupção não planeada superior a 4 horas nos últimos 24 meses?', 'Se sim, descreva no campo de justificação o que aconteceu e o que mudou desde então.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 11, 'Histórico'),
    (v_template, 'Existe processo de comunicação de incidentes aos clientes?', 'Com prazo definido para o primeiro aviso.', 'radio', '["Sim","Não"]'::jsonb, true, 3, 12, 'Histórico');
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 2. Integridade e Anticorrupção
  -- ══════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.due_diligence_templates WHERE nome = 'Integridade e Anticorrupção' AND padrao = true) THEN
    INSERT INTO public.due_diligence_templates (empresa_id, nome, descricao, categoria, ativo, padrao, versao)
    VALUES (v_empresa_padrao, 'Integridade e Anticorrupção',
            'Avalia o programa de integridade do fornecedor. Indicado quando ele nos representa perante terceiros, lida com dinheiro público ou opera em jurisdição de risco.',
            'Compliance', true, true, 1)
    RETURNING id INTO v_template;

    INSERT INTO public.due_diligence_questions (template_id, titulo, descricao, tipo, opcoes, obrigatoria, peso, ordem, secao) VALUES
    (v_template, 'Existe código de conduta formalizado e comunicado?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 1, 'Programa'),
    (v_template, 'Existe política anticorrupção específica?', 'Distinta do código de conduta genérico.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 2, 'Programa'),
    (v_template, 'A liderança comunica formalmente o compromisso com a integridade?', 'Tom vindo do topo, registado.', 'radio', '["Sim","Não"]'::jsonb, false, 2, 3, 'Programa'),
    (v_template, 'Existe formação periódica em integridade para colaboradores?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 4, 'Programa'),

    (v_template, 'Existe canal de denúncia acessível e com garantia de anonimato?', 'Sem canal, o programa não tem como detetar nada.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 5, 'Canal e apuração'),
    (v_template, 'O canal está disponível a terceiros, não só a colaboradores?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 6, 'Canal e apuração'),
    (v_template, 'Existe procedimento formal de apuração das denúncias?', 'Com prazos e independência de quem apura.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 7, 'Canal e apuração'),
    (v_template, 'Existe política de não retaliação?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 8, 'Canal e apuração'),

    (v_template, 'Os próprios fornecedores são submetidos a due diligence de integridade?', 'O risco entra pela cadeia.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 9, 'Terceiros'),
    (v_template, 'Existe política sobre brindes, hospitalidade e entretenimento?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 10, 'Terceiros'),
    (v_template, 'Existe registo de conflitos de interesse declarados?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 11, 'Terceiros'),

    (v_template, 'A organização, sócios ou administradores foram condenados por corrupção ou fraude?', 'Se sim, descreva na justificação. Omitir aqui é, por si, um achado.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 12, 'Histórico'),
    (v_template, 'A organização consta de listas restritivas ou de sanções?', 'OFAC, União Europeia, CEIS, CNEP ou equivalentes.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 13, 'Histórico'),
    (v_template, 'Existe pessoa politicamente exposta (PEP) no quadro societário?', 'Não é impedimento; é informação que muda o nível de acompanhamento.', 'radio', '["Sim","Não"]'::jsonb, true, 3, 14, 'Histórico');
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 3. Trabalho e Direitos Humanos (ESG)
  -- ══════════════════════════════════════════════════════════════════════
  IF NOT EXISTS (SELECT 1 FROM public.due_diligence_templates WHERE nome = 'Trabalho e Direitos Humanos' AND padrao = true) THEN
    INSERT INTO public.due_diligence_templates (empresa_id, nome, descricao, categoria, ativo, padrao, versao)
    VALUES (v_empresa_padrao, 'Trabalho e Direitos Humanos',
            'Avalia práticas laborais e de direitos humanos na operação do fornecedor e na sua cadeia. Indicado para fornecedores com mão de obra intensiva ou cadeia longa.',
            'ESG', true, true, 1)
    RETURNING id INTO v_template;

    INSERT INTO public.due_diligence_questions (template_id, titulo, descricao, tipo, opcoes, obrigatoria, peso, ordem, secao) VALUES
    (v_template, 'Existe garantia formal de ausência de trabalho forçado ou análogo ao escravo?', 'Sozinho, um "não" aqui desqualifica.', 'radio', '["Sim","Não"]'::jsonb, true, 5, 1, 'Trabalho digno'),
    (v_template, 'Existe garantia formal de ausência de trabalho infantil?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 5, 2, 'Trabalho digno'),
    (v_template, 'Os vínculos laborais estão regularizados conforme a legislação local?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 3, 'Trabalho digno'),
    (v_template, 'A jornada e as horas extraordinárias respeitam os limites legais?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 4, 'Trabalho digno'),
    (v_template, 'É respeitada a liberdade de associação e negociação coletiva?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 5, 'Trabalho digno'),

    (v_template, 'Existe programa de saúde e segurança no trabalho?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 6, 'Saúde e segurança'),
    (v_template, 'Houve acidente de trabalho grave ou fatal nos últimos 24 meses?', 'Se sim, descreva na justificação o que mudou desde então.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 7, 'Saúde e segurança'),
    (v_template, 'Os equipamentos de proteção são fornecidos e o uso é fiscalizado?', NULL, 'radio', '["Sim","Não"]'::jsonb, false, 2, 8, 'Saúde e segurança'),

    (v_template, 'Existe política de não discriminação e de diversidade?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 3, 9, 'Equidade'),
    (v_template, 'Existe canal para denúncia de assédio com apuração independente?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 10, 'Equidade'),

    (v_template, 'Os subfornecedores são avaliados quanto a práticas laborais?', 'O risco reputacional atravessa a cadeia inteira.', 'radio', '["Sim","Não"]'::jsonb, true, 4, 11, 'Cadeia'),
    (v_template, 'Existe auditoria de terceira parte às condições de trabalho?', NULL, 'radio', '["Sim","Não"]'::jsonb, false, 3, 12, 'Cadeia'),
    (v_template, 'A organização foi autuada por infração laboral nos últimos 24 meses?', NULL, 'radio', '["Sim","Não"]'::jsonb, true, 4, 13, 'Cadeia');
  END IF;

  RAISE NOTICE 'templates de due diligence: % padrão disponíveis',
    (SELECT count(*) FROM public.due_diligence_templates WHERE padrao = true);
END $$;
