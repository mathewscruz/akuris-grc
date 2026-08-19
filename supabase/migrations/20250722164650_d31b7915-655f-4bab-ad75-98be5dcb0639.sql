-- Create profile for existing user if it doesn't exist
INSERT INTO public.profiles (user_id, nome, email, role)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)),
  u.email,
  CASE 
    WHEN u.email = 'admin@governaii.com' THEN 'super_admin'::public.user_role
    ELSE 'user'::public.user_role
  END
FROM auth.users u
WHERE u.id NOT IN (SELECT user_id FROM public.profiles)
  AND u.id IS NOT NULL;

-- Also ensure the trigger is properly working by recreating it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN NEW.email = 'admin@governaii.com' THEN 'super_admin'::public.user_role
      ELSE 'user'::public.user_role
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error and continue with user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();