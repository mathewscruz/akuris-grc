ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.empresas ADD CONSTRAINT empresas_moeda_check CHECK (moeda IN ('EUR','BRL','USD','GBP'));