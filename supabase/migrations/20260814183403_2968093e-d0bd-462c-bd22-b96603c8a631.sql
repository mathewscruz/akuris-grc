ALTER TABLE public.ativos DISABLE TRIGGER audit_ativos_trigger;

UPDATE public.ativos SET tipo = 'equipamento_escritorio' WHERE tipo = 'escritorio';
UPDATE public.ativos SET tipo = 'nao_classificado' WHERE tipo = 'tecnologia';

ALTER TABLE public.ativos ENABLE TRIGGER audit_ativos_trigger;