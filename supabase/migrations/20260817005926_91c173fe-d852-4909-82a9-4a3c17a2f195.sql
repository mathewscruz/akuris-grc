ALTER TABLE public.ropa_registros
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS area_responsavel text,
  ADD COLUMN IF NOT EXISTS dados_tratados text,
  ADD COLUMN IF NOT EXISTS categoria_dados text,
  ADD COLUMN IF NOT EXISTS fonte_dados text,
  ADD COLUMN IF NOT EXISTS descricao_atividade text,
  ADD COLUMN IF NOT EXISTS operacoes_realizadas text,
  ADD COLUMN IF NOT EXISTS decisao_automatizada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decisao_automatizada_detalhes text,
  ADD COLUMN IF NOT EXISTS justificativa_base_legal text,
  ADD COLUMN IF NOT EXISTS compartilhamento_interno text,
  ADD COLUMN IF NOT EXISTS compartilhamento_externo text,
  ADD COLUMN IF NOT EXISTS transferencia_detalhes text,
  ADD COLUMN IF NOT EXISTS criterio_descarte text,
  ADD COLUMN IF NOT EXISTS risco_probabilidade text,
  ADD COLUMN IF NOT EXISTS risco_impacto text,
  ADD COLUMN IF NOT EXISTS risco_nivel text,
  ADD COLUMN IF NOT EXISTS evidencias_documentos text,
  ADD COLUMN IF NOT EXISTS versao text NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_ropa_registros_empresa ON public.ropa_registros (empresa_id);