-- Fix RLS and database defaults for denuncias tables
-- Make empresa_id default to current user's empresa_id

-- Update denuncias_categorias table to auto-set empresa_id
ALTER TABLE public.denuncias_categorias 
ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();

-- Update denuncias_configuracoes table to auto-set empresa_id  
ALTER TABLE public.denuncias_configuracoes
ALTER COLUMN empresa_id SET DEFAULT get_user_empresa_id();

-- Create missing foreign key relationships for joins
ALTER TABLE public.denuncias_movimentacoes 
ADD CONSTRAINT fk_movimentacoes_usuario 
FOREIGN KEY (usuario_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.denuncias 
ADD CONSTRAINT fk_denuncias_responsavel 
FOREIGN KEY (responsavel_id) REFERENCES public.profiles(user_id);