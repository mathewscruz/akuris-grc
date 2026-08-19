-- Adicionar campo padrao para templates padrão
ALTER TABLE public.due_diligence_templates 
ADD COLUMN padrao BOOLEAN DEFAULT false;

-- Atualizar RLS policies para templates padrão
DROP POLICY IF EXISTS "Users can view templates from their empresa" ON public.due_diligence_templates;

CREATE POLICY "Users can view templates from their empresa or standard templates" 
ON public.due_diligence_templates 
FOR SELECT 
USING (empresa_id = get_user_empresa_id() OR padrao = true);

-- Inserir template padrão "Segurança da Informação"
INSERT INTO public.due_diligence_templates (
  empresa_id, 
  nome, 
  descricao, 
  categoria, 
  ativo, 
  versao, 
  padrao
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- UUID especial para templates padrão
  'Segurança da Informação',
  'Questionário padrão para avaliar a maturidade em segurança da informação do fornecedor/parceiro. Aborda políticas, controles técnicos, gestão de riscos e conformidade.',
  'Segurança',
  true,
  '1.0',
  true
);

-- Inserir template padrão "Privacidade de Dados (LGPD)"
INSERT INTO public.due_diligence_templates (
  empresa_id, 
  nome, 
  descricao, 
  categoria, 
  ativo, 
  versao, 
  padrao
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- UUID especial para templates padrão
  'Privacidade de Dados (LGPD)',
  'Questionário padrão para avaliar conformidade com a Lei Geral de Proteção de Dados (LGPD). Avalia práticas de privacidade, gestão de dados pessoais e controles de proteção.',
  'Privacidade',
  true,
  '1.0',
  true
);