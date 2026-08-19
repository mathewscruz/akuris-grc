
-- Criar tabela para trilha de auditoria
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  empresa_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para que usuários vejam apenas logs de sua empresa
CREATE POLICY "Users can view audit logs from their empresa" 
ON public.audit_logs 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

-- Criar tabela para gestão de evidências
CREATE TABLE public.controles_evidencias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  controle_id uuid NOT NULL,
  controle_teste_id uuid,
  nome text NOT NULL,
  descricao text,
  arquivo_url text,
  arquivo_nome text,
  arquivo_tamanho bigint,
  arquivo_tipo text,
  versao integer DEFAULT 1,
  is_current_version boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela controles_evidencias
ALTER TABLE public.controles_evidencias ENABLE ROW LEVEL SECURITY;

-- Políticas para evidencias
CREATE POLICY "Users can view evidences from their empresa controles" 
ON public.controles_evidencias 
FOR SELECT 
USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can insert evidences in their empresa controles" 
ON public.controles_evidencias 
FOR INSERT 
WITH CHECK (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can update evidences from their empresa controles" 
ON public.controles_evidencias 
FOR UPDATE 
USING (controle_pertence_empresa(controle_id));

CREATE POLICY "Users can delete evidences from their empresa controles" 
ON public.controles_evidencias 
FOR DELETE 
USING (controle_pertence_empresa(controle_id));

-- Criar tabela para templates de compliance
CREATE TABLE public.compliance_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  framework text NOT NULL, -- 'SOX', 'COSO', 'ISO27001', etc
  checklist jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela compliance_templates
ALTER TABLE public.compliance_templates ENABLE ROW LEVEL SECURITY;

-- Políticas para templates de compliance
CREATE POLICY "Users can manage compliance templates from their empresa" 
ON public.compliance_templates 
FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

-- Criar tabela para relatórios salvos
CREATE TABLE public.relatorios_salvos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL, -- 'eficacia', 'compliance', 'gaps', etc
  configuracao jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela relatorios_salvos
ALTER TABLE public.relatorios_salvos ENABLE ROW LEVEL SECURITY;

-- Políticas para relatórios salvos
CREATE POLICY "Users can manage saved reports from their empresa" 
ON public.relatorios_salvos 
FOR ALL 
USING (empresa_id = get_user_empresa_id())
WITH CHECK (empresa_id = get_user_empresa_id());

-- Criar bucket para evidências de controles
INSERT INTO storage.buckets (id, name, public) 
VALUES ('controles-evidencias', 'controles-evidencias', false);

-- Criar políticas para o bucket controles-evidencias
CREATE POLICY "Authenticated users can view controles evidencias" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'controles-evidencias' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload controles evidencias" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'controles-evidencias' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update controles evidencias" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'controles-evidencias' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete controles evidencias" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'controles-evidencias' AND 
  auth.role() = 'authenticated'
);

-- Função para criar log de auditoria
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_changed_fields text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    empresa_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    auth.uid(),
    get_user_empresa_id(),
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    p_changed_fields
  );
END;
$$;

-- Trigger para auditoria da tabela controles
CREATE OR REPLACE FUNCTION public.audit_controles_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  changed_fields text[] := '{}';
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_values = to_jsonb(NEW);
    PERFORM create_audit_log('controles', NEW.id, 'INSERT', NULL, new_values);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_values = to_jsonb(OLD);
    new_values = to_jsonb(NEW);
    
    -- Detectar campos alterados
    IF OLD.nome != NEW.nome THEN changed_fields = array_append(changed_fields, 'nome'); END IF;
    IF OLD.descricao != NEW.descricao THEN changed_fields = array_append(changed_fields, 'descricao'); END IF;
    IF OLD.status != NEW.status THEN changed_fields = array_append(changed_fields, 'status'); END IF;
    IF OLD.criticidade != NEW.criticidade THEN changed_fields = array_append(changed_fields, 'criticidade'); END IF;
    
    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM create_audit_log('controles', NEW.id, 'UPDATE', old_values, new_values, changed_fields);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_values = to_jsonb(OLD);
    PERFORM create_audit_log('controles', OLD.id, 'DELETE', old_values, NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Criar trigger para auditoria
CREATE TRIGGER audit_controles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.controles
  FOR EACH ROW EXECUTE FUNCTION audit_controles_changes();
