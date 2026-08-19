-- Corrigir esquema da tabela due_diligence_scores para ser compatível com a função
-- Adicionar colunas necessárias e remover as antigas que não são mais usadas

-- Primeiro, remover colunas antigas que não são mais necessárias
ALTER TABLE public.due_diligence_scores 
DROP COLUMN IF EXISTS categoria,
DROP COLUMN IF EXISTS pontuacao_obtida,
DROP COLUMN IF EXISTS pontuacao_maxima,
DROP COLUMN IF EXISTS percentual;

-- Adicionar as novas colunas necessárias
ALTER TABLE public.due_diligence_scores 
ADD COLUMN IF NOT EXISTS score_total DECIMAL NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS observacoes_ia TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Adicionar trigger para updated_at
DROP TRIGGER IF EXISTS update_due_diligence_scores_updated_at ON public.due_diligence_scores;
CREATE TRIGGER update_due_diligence_scores_updated_at
  BEFORE UPDATE ON public.due_diligence_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();