-- Durations can be expressed in fractions of an hour; never silently floor.
ALTER TABLE public.continuidade_planos
 ALTER COLUMN rto_horas TYPE numeric USING rto_horas::numeric,
 ALTER COLUMN rpo_horas TYPE numeric USING rpo_horas::numeric;
ALTER TABLE public.continuidade_planos ADD CONSTRAINT recovery_hours_valid CHECK (
 (rto_horas IS NULL OR (rto_horas>=0 AND rto_horas::text NOT IN ('NaN','Infinity'))) AND
 (rpo_horas IS NULL OR (rpo_horas>=0 AND rpo_horas::text NOT IN ('NaN','Infinity')))
) NOT VALID;
