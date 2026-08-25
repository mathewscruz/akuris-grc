-- Defesa em profundidade sobre a migração anterior.
--
-- `cifrar_credenciais` e o gatilho `tg_cifra_credenciais` ficaram com o EXECUTE
-- por omissão a PUBLIC — que inclui anon. Não vazam a chave nem decifram, mas
-- não têm que responder a quem não é o serviço. Fecha-se a porta.

REVOKE ALL ON FUNCTION public.cifrar_credenciais(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_cifra_credenciais() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.cifrar_credenciais(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ler_credenciais_integracao(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.chave_credenciais_integracao()', 'EXECUTE') THEN
    RAISE EXCEPTION 'cripto: funções de credencial continuam ao alcance do anon';
  END IF;
  RAISE NOTICE 'cripto: funções de credencial fora do alcance de anon/authenticated';
END $$;
