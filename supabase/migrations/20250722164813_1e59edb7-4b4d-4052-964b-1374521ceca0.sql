-- Create Nexure company if it doesn't exist
INSERT INTO public.empresas (nome, ativo)
VALUES ('Nexure', true)
ON CONFLICT DO NOTHING;

-- Get the company ID for Nexure
DO $$
DECLARE
    nexure_id UUID;
    user_id_var UUID := '665e71d9-a3ef-49d2-adfa-10e73c631bbf';
BEGIN
    -- Get Nexure company ID
    SELECT id INTO nexure_id FROM public.empresas WHERE nome = 'Nexure';
    
    -- Update user profile to be super_admin and link to Nexure
    UPDATE public.profiles 
    SET 
        nome = 'Mathews Cruz',
        email = 'henrique.mathews@gmail.com',
        role = 'super_admin'::public.user_role,
        empresa_id = nexure_id,
        updated_at = now()
    WHERE user_id = user_id_var;
    
    -- If profile doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO public.profiles (user_id, nome, email, role, empresa_id)
        VALUES (user_id_var, 'Mathews Cruz', 'henrique.mathews@gmail.com', 'super_admin'::public.user_role, nexure_id);
    END IF;
END $$;