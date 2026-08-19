-- Criar tabela para anexos de riscos
CREATE TABLE public.riscos_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  risco_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_arquivo BIGINT,
  tipo_anexo TEXT NOT NULL DEFAULT 'aceite',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  empresa_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.riscos_anexos ENABLE ROW LEVEL SECURITY;

-- Create policies for riscos_anexos
CREATE POLICY "Users can view anexos from their empresa riscos" 
ON public.riscos_anexos 
FOR SELECT 
USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can create anexos in their empresa riscos" 
ON public.riscos_anexos 
FOR INSERT 
WITH CHECK (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can update anexos from their empresa riscos" 
ON public.riscos_anexos 
FOR UPDATE 
USING (risco_pertence_empresa(risco_id));

CREATE POLICY "Users can delete anexos from their empresa riscos" 
ON public.riscos_anexos 
FOR DELETE 
USING (risco_pertence_empresa(risco_id));

-- Create storage bucket for riscos anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('riscos-anexos', 'riscos-anexos', false);

-- Create storage policies for riscos-anexos bucket
CREATE POLICY "Users can view their empresa riscos anexos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'riscos-anexos' AND 
  EXISTS (
    SELECT 1 FROM public.riscos_anexos ra
    INNER JOIN public.riscos r ON ra.risco_id = r.id
    WHERE ra.url_arquivo LIKE '%' || name || '%'
    AND r.empresa_id = get_user_empresa_id()
  )
);

CREATE POLICY "Users can upload riscos anexos for their empresa" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'riscos-anexos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their empresa riscos anexos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'riscos-anexos' AND 
  EXISTS (
    SELECT 1 FROM public.riscos_anexos ra
    INNER JOIN public.riscos r ON ra.risco_id = r.id
    WHERE ra.url_arquivo LIKE '%' || name || '%'
    AND r.empresa_id = get_user_empresa_id()
  )
);

CREATE POLICY "Users can delete their empresa riscos anexos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'riscos-anexos' AND 
  EXISTS (
    SELECT 1 FROM public.riscos_anexos ra
    INNER JOIN public.riscos r ON ra.risco_id = r.id
    WHERE ra.url_arquivo LIKE '%' || name || '%'
    AND r.empresa_id = get_user_empresa_id()
  )
);