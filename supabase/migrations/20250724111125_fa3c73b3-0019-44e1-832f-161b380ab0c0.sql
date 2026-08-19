-- Criar tabela de manutenções para ativos
CREATE TABLE public.ativos_manutencoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  tipo_manutencao TEXT NOT NULL CHECK (tipo_manutencao IN ('preventiva', 'corretiva', 'emergencial', 'melhorias')),
  descricao TEXT NOT NULL,
  data_manutencao DATE NOT NULL,
  data_prevista_conclusao DATE,
  data_conclusao DATE,
  responsavel TEXT,
  fornecedor TEXT,
  custo DECIMAL(15,2),
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  observacoes TEXT,
  proxima_manutencao DATE,
  criticidade TEXT DEFAULT 'media' CHECK (criticidade IN ('baixa', 'media', 'alta', 'critica')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Habilitar RLS
ALTER TABLE public.ativos_manutencoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para manutenções
CREATE POLICY "Users can view manutencoes from their empresa" 
ON public.ativos_manutencoes 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert manutencoes in their empresa" 
ON public.ativos_manutencoes 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update manutencoes from their empresa" 
ON public.ativos_manutencoes 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete manutencoes from their empresa" 
ON public.ativos_manutencoes 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ativos_manutencoes_updated_at
  BEFORE UPDATE ON public.ativos_manutencoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função de auditoria para ativos
CREATE OR REPLACE FUNCTION public.audit_ativos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields text[] := '{}';
  old_values jsonb;
  new_values jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_values = to_jsonb(NEW);
    PERFORM create_audit_log('ativos', NEW.id, 'INSERT', NULL, new_values);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_values = to_jsonb(OLD);
    new_values = to_jsonb(NEW);
    
    -- Detectar campos alterados
    IF OLD.nome != NEW.nome THEN changed_fields = array_append(changed_fields, 'nome'); END IF;
    IF OLD.tipo != NEW.tipo THEN changed_fields = array_append(changed_fields, 'tipo'); END IF;
    IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN changed_fields = array_append(changed_fields, 'descricao'); END IF;
    IF OLD.proprietario IS DISTINCT FROM NEW.proprietario THEN changed_fields = array_append(changed_fields, 'proprietario'); END IF;
    IF OLD.localizacao IS DISTINCT FROM NEW.localizacao THEN changed_fields = array_append(changed_fields, 'localizacao'); END IF;
    IF OLD.valor_negocio IS DISTINCT FROM NEW.valor_negocio THEN changed_fields = array_append(changed_fields, 'valor_negocio'); END IF;
    IF OLD.criticidade != NEW.criticidade THEN changed_fields = array_append(changed_fields, 'criticidade'); END IF;
    IF OLD.status != NEW.status THEN changed_fields = array_append(changed_fields, 'status'); END IF;
    IF OLD.data_aquisicao IS DISTINCT FROM NEW.data_aquisicao THEN changed_fields = array_append(changed_fields, 'data_aquisicao'); END IF;
    IF OLD.fornecedor IS DISTINCT FROM NEW.fornecedor THEN changed_fields = array_append(changed_fields, 'fornecedor'); END IF;
    IF OLD.versao IS DISTINCT FROM NEW.versao THEN changed_fields = array_append(changed_fields, 'versao'); END IF;
    IF OLD.tags IS DISTINCT FROM NEW.tags THEN changed_fields = array_append(changed_fields, 'tags'); END IF;
    IF OLD.imei IS DISTINCT FROM NEW.imei THEN changed_fields = array_append(changed_fields, 'imei'); END IF;
    IF OLD.cliente IS DISTINCT FROM NEW.cliente THEN changed_fields = array_append(changed_fields, 'cliente'); END IF;
    IF OLD.quantidade IS DISTINCT FROM NEW.quantidade THEN changed_fields = array_append(changed_fields, 'quantidade'); END IF;
    
    IF array_length(changed_fields, 1) > 0 THEN
      PERFORM create_audit_log('ativos', NEW.id, 'UPDATE', old_values, new_values, changed_fields);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_values = to_jsonb(OLD);
    PERFORM create_audit_log('ativos', OLD.id, 'DELETE', old_values, NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Criar trigger de auditoria para ativos
CREATE TRIGGER audit_ativos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ativos
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ativos_changes();

-- Índices para melhor performance
CREATE INDEX idx_ativos_manutencoes_ativo_id ON public.ativos_manutencoes(ativo_id);
CREATE INDEX idx_ativos_manutencoes_empresa_id ON public.ativos_manutencoes(empresa_id);
CREATE INDEX idx_ativos_manutencoes_data_manutencao ON public.ativos_manutencoes(data_manutencao);
CREATE INDEX idx_ativos_manutencoes_status ON public.ativos_manutencoes(status);
CREATE INDEX idx_ativos_manutencoes_proxima_manutencao ON public.ativos_manutencoes(proxima_manutencao);