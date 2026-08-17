CREATE TABLE public.ropa_exercicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  versao TEXT,
  data_realizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_inicio DATE,
  periodo_fim DATE,
  responsavel_id UUID,
  dpo_id UUID,
  escopo TEXT,
  metodologia TEXT,
  status TEXT NOT NULL DEFAULT 'em_curso',
  conclusoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ropa_exercicios TO authenticated;
GRANT ALL ON public.ropa_exercicios TO service_role;

ALTER TABLE public.ropa_exercicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa ve seus exercicios ropa" ON public.ropa_exercicios
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa cria exercicios ropa" ON public.ropa_exercicios
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa atualiza exercicios ropa" ON public.ropa_exercicios
  FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa apaga exercicios ropa" ON public.ropa_exercicios
  FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER set_ropa_exercicios_updated_at
  BEFORE UPDATE ON public.ropa_exercicios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ropa_exercicios_empresa ON public.ropa_exercicios(empresa_id);

CREATE TABLE public.ropa_exercicio_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercicio_id UUID NOT NULL REFERENCES public.ropa_exercicios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'evidencia',
  nome_arquivo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  mime_type TEXT,
  tamanho BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ropa_exercicio_anexos TO authenticated;
GRANT ALL ON public.ropa_exercicio_anexos TO service_role;

ALTER TABLE public.ropa_exercicio_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa ve anexos exercicio ropa" ON public.ropa_exercicio_anexos
  FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa cria anexos exercicio ropa" ON public.ropa_exercicio_anexos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa atualiza anexos exercicio ropa" ON public.ropa_exercicio_anexos
  FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa apaga anexos exercicio ropa" ON public.ropa_exercicio_anexos
  FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER set_ropa_exercicio_anexos_updated_at
  BEFORE UPDATE ON public.ropa_exercicio_anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ropa_exercicio_anexos_exercicio ON public.ropa_exercicio_anexos(exercicio_id);

ALTER TABLE public.ropa_registros
  ADD COLUMN IF NOT EXISTS exercicio_id UUID REFERENCES public.ropa_exercicios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ropa_registros_exercicio ON public.ropa_registros(exercicio_id);

CREATE POLICY "Empresa le ropa docs storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dados-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY "Empresa envia ropa docs storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dados-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);
CREATE POLICY "Empresa apaga ropa docs storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dados-documentos' AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text);