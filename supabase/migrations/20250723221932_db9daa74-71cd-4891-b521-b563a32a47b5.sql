-- Corrigir TODAS as perguntas de Due Diligence restantes

-- 1. Atualizar TODAS as perguntas restantes de Privacidade de Dados (LGPD) (ordens 11-30)
UPDATE public.due_diligence_questions 
SET 
  opcoes = '["Sim", "Não"]'::jsonb,
  tipo = 'radio',
  configuracoes = jsonb_build_object(
    'mostrar_evidencia_quando', 'Sim',
    'mostrar_justificativa_quando', 'Não',
    'label_evidencia', 'Forneça evidências de conformidade com a LGPD:',
    'label_justificativa', 'Explique a situação atual e planos de adequação à LGPD:'
  )
WHERE template_id = (
  SELECT id FROM due_diligence_templates 
  WHERE nome = 'Privacidade de Dados (LGPD)' AND padrao = true
)
AND ordem BETWEEN 11 AND 30;

-- 2. Atualizar TODAS as perguntas restantes de Segurança da Informação (ordens 21-70)
UPDATE public.due_diligence_questions 
SET 
  opcoes = '["Sim", "Não"]'::jsonb,
  tipo = 'radio',
  configuracoes = jsonb_build_object(
    'mostrar_evidencia_quando', 'Sim',
    'mostrar_justificativa_quando', 'Não',
    'label_evidencia', 'Descreva a evidência ou documentação que comprova a implementação:',
    'label_justificativa', 'Explique por que não está implementado e indique planos futuros:'
  )
WHERE template_id = (
  SELECT id FROM due_diligence_templates 
  WHERE nome = 'Segurança da Informação' AND padrao = true
)
AND ordem BETWEEN 21 AND 70;

-- 3. Ajustar perguntas específicas sobre frequência e periodicidade
UPDATE public.due_diligence_questions 
SET 
  tipo = 'radio',
  opcoes = '["Diário", "Semanal", "Mensal", "Trimestral", "Anual", "Não realiza"]'::jsonb,
  configuracoes = jsonb_build_object(
    'mostrar_evidencia_quando', 'Diário,Semanal,Mensal,Trimestral,Anual',
    'mostrar_justificativa_quando', 'Não realiza',
    'label_evidencia', 'Descreva o processo e forneça evidências:',
    'label_justificativa', 'Explique por que não realiza e planos futuros:'
  )
WHERE titulo ILIKE ANY(ARRAY[
  '%frequência%',
  '%periodicidade%',
  '%regularidade%',
  '%com que frequência%',
  '%cada quanto tempo%'
]);

-- 4. Ajustar perguntas que pedem valores numéricos para texto
UPDATE public.due_diligence_questions 
SET 
  tipo = 'texto',
  opcoes = NULL,
  configuracoes = jsonb_build_object(
    'placeholder', 'Digite sua resposta',
    'obrigatorio', true
  )
WHERE titulo ILIKE ANY(ARRAY[
  '%quantos%',
  '%número%',
  '%quantidade%',
  '%tempo de resposta%',
  '%prazo%',
  '%valor%'
]);

-- 5. Garantir que perguntas críticas tenham peso maior
UPDATE public.due_diligence_questions 
SET peso = 3
WHERE titulo ILIKE ANY(ARRAY[
  '%política%segurança%',
  '%lgpd%',
  '%backup%',
  '%controle%acesso%',
  '%incidente%',
  '%auditoria%',
  '%criptografia%',
  '%firewall%',
  '%antivírus%',
  '%dados pessoais%',
  '%consentimento%',
  '%titular%'
]);

-- 6. Garantir que todas as perguntas tenham pelo menos peso 1
UPDATE public.due_diligence_questions 
SET peso = 1
WHERE peso IS NULL OR peso < 1;