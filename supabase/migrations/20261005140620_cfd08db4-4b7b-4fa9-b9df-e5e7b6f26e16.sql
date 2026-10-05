INSERT INTO public.system_modules (name, display_name, order_index, is_active)
SELECT 'continuidade', 'Continuidade de Negócios', 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.system_modules WHERE name = 'continuidade');