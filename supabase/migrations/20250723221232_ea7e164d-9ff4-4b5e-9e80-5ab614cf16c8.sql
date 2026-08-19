-- Corrigir perguntas de Due Diligence existentes - adicionar opções e configurações condicionais

-- 1. Atualizar perguntas de Segurança da Informação para ter opções adequadas
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
AND ordem IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);

-- 2. Atualizar perguntas de Privacidade para ter opções adequadas  
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
AND ordem IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

-- 3. Ajustar algumas perguntas específicas que precisam de tipos diferentes

-- Pergunta sobre quantidade de incidentes (deve ser numérico)
UPDATE public.due_diligence_questions 
SET 
  tipo = 'numerico',
  opcoes = NULL,
  configuracoes = jsonb_build_object(
    'min', 0,
    'placeholder', 'Digite o número de incidentes nos últimos 12 meses'
  )
WHERE titulo ILIKE '%quantos incidentes%' OR titulo ILIKE '%número de incidentes%';

-- Pergunta sobre tempo de resposta (deve ser numérico)
UPDATE public.due_diligence_questions 
SET 
  tipo = 'numerico',
  opcoes = NULL,
  configuracoes = jsonb_build_object(
    'min', 1,
    'placeholder', 'Digite o tempo em horas'
  )
WHERE titulo ILIKE '%tempo de resposta%' OR titulo ILIKE '%prazo de resposta%';

-- Perguntas sobre frequência de backup e auditoria (select com opções específicas)
UPDATE public.due_diligence_questions 
SET 
  tipo = 'radio',
  opcoes = '["Diário", "Semanal", "Mensal", "Não realiza"]'::jsonb,
  configuracoes = jsonb_build_object(
    'mostrar_evidencia_quando', 'Diário,Semanal,Mensal',
    'mostrar_justificativa_quando', 'Não realiza',
    'label_evidencia', 'Descreva o processo e forneça evidências:',
    'label_justificativa', 'Explique por que não realiza e planos futuros:'
  )
WHERE titulo ILIKE '%frequência%backup%' OR titulo ILIKE '%periodicidade%auditoria%';

-- 4. Ajustar pesos das perguntas mais críticas
UPDATE public.due_diligence_questions 
SET peso = 3
WHERE titulo ILIKE ANY(ARRAY[
  '%política%segurança%',
  '%lgpd%',
  '%backup%',
  '%controle%acesso%',
  '%incidente%',
  '%auditoria%'
]);

-- 5. Verificar se todas as perguntas têm peso definido
UPDATE public.due_diligence_questions 
SET peso = 1
WHERE peso IS NULL;

-- 6. Adicionar campo para armazenar evidências e justificativas nas respostas
ALTER TABLE public.due_diligence_responses 
ADD COLUMN IF NOT EXISTS evidencia TEXT,
ADD COLUMN IF NOT EXISTS justificativa TEXT;