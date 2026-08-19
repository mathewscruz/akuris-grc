-- Idioma padrão do perfil deixa de ser português de Portugal.
--
-- `profiles.preferred_locale` tinha `DEFAULT 'pt'` (Portugal). Como a aplicação
-- normaliza o dicionário inteiro para a variante activa (src/lib/pt-variants.ts),
-- todo utilizador novo — inclusive em empresa com `jurisdicao = 'BR'` — abria a
-- interface em "registado", "utilizador", "Gerir", "Eliminar", "Guardar".
--
-- Passa a derivar da jurisdição da empresa. Quando o cliente não envia nada, o
-- gatilho preenche; a coluna continua NOT NULL porque BEFORE INSERT corre antes
-- da verificação da restrição.

ALTER TABLE public.profiles ALTER COLUMN preferred_locale DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.profiles_set_locale_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.preferred_locale IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE e.jurisdicao
           WHEN 'BR' THEN 'pt-BR'
           WHEN 'PT_EU' THEN 'pt'
           WHEN 'INTL' THEN 'en'
         END
    INTO NEW.preferred_locale
  FROM public.empresas e
  WHERE e.id = NEW.empresa_id;

  -- Empresa sem jurisdição definida (ou perfil ainda sem empresa): pt-BR é o
  -- mercado principal e o cliente reavalia por fuso horário na primeira carga.
  NEW.preferred_locale := COALESCE(NEW.preferred_locale, 'pt-BR');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_locale_padrao_trg ON public.profiles;
CREATE TRIGGER profiles_set_locale_padrao_trg
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_locale_padrao();

-- Correcção do que já está gravado: só as linhas que ainda têm o antigo padrão
-- 'pt' numa empresa brasileira. Quem escolheu português de Portugal de propósito
-- numa empresa PT_EU ou INTL fica intocado, e o selector continua disponível.
UPDATE public.profiles p
   SET preferred_locale = 'pt-BR'
  FROM public.empresas e
 WHERE p.empresa_id = e.id
   AND e.jurisdicao = 'BR'
   AND p.preferred_locale = 'pt';

COMMENT ON FUNCTION public.profiles_set_locale_padrao() IS
  'Preenche profiles.preferred_locale a partir de empresas.jurisdicao quando o cliente não envia idioma.';
