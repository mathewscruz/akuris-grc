
-- Add calculation method field to risk matrix configuration
ALTER TABLE public.riscos_matriz_configuracao 
ADD COLUMN metodo_calculo TEXT NOT NULL DEFAULT 'multiplicacao';

-- Add check constraint to ensure only valid values
ALTER TABLE public.riscos_matriz_configuracao 
ADD CONSTRAINT check_metodo_calculo 
CHECK (metodo_calculo IN ('multiplicacao', 'soma'));

-- Update existing records to use multiplication method
UPDATE public.riscos_matriz_configuracao 
SET metodo_calculo = 'multiplicacao' 
WHERE metodo_calculo IS NULL;
