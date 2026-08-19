-- Adicionar campo slug para URLs amigáveis nas empresas
ALTER TABLE public.empresas 
ADD COLUMN slug text UNIQUE;

-- Criar índice para melhor performance
CREATE INDEX idx_empresas_slug ON public.empresas(slug);

-- Atualizar empresas existentes com slug baseado no nome
UPDATE public.empresas 
SET slug = LOWER(REGEXP_REPLACE(TRIM(nome), '[^a-zA-Z0-9\s]', '', 'g'))
WHERE slug IS NULL;

-- Função para buscar empresa por slug
CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(empresa_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.empresas 
  WHERE slug = empresa_slug AND ativo = true
  LIMIT 1;
$$;