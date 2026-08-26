-- «Outro» e «Outros» na mesma lista de categorias do canal de denúncias.
--
-- ## O que se vê
--
-- Na página pública do canal, a lista «O QUE PODE SER RELATADO» mostrava:
--
--     Assédio · Conflito de Interesses · Corrupção · Discriminação ·
--     Ética · Fraude · **Outro** · **Outros** · Segurança
--
-- Duas opções com o mesmo significado, uma a seguir à outra, no formulário
-- mais sensível do produto. Quem vai relatar uma irregularidade tem de
-- adivinhar qual escolher — e o efeito não é só a hesitação: os relatos
-- ficam repartidos por dois baldes, e a estatística do comité passa a contar
-- «Outro: 3» e «Outros: 5» quando são oito da mesma coisa.
--
-- ## Como aconteceu
--
-- «Outro» nasceu em 2025-07-23 e «Outros» em 2026-08-17. Uma sementeira
-- posterior acrescentou a segunda sem reparar que a primeira já lá estava.
-- Três empresas ficaram com as duas.
--
-- ## O que se faz, e onde se pára
--
-- Desactiva a antiga — e SÓ quando as duas condições se verificam:
--
--   1. a empresa tem mesmo as duas, e
--   2. a que vai sair não tem nenhuma denúncia associada.
--
-- Conferido antes de escrever isto: nas três empresas, ambas as categorias
-- têm ZERO denúncias. Não se perde nada.
--
-- Se alguma tiver relatos, fica como está. Mover um relato de categoria é
-- reclassificar uma denúncia — decisão do comité, não de uma migração. E
-- `ativo = false` não apaga: tira da lista pública e mantém o histórico.

DO $$
DECLARE
  r record;
  v_desactivadas integer := 0;
  v_mantidas integer := 0;
BEGIN
  FOR r IN
    SELECT antiga.id, antiga.empresa_id,
           (SELECT count(*) FROM public.denuncias d WHERE d.categoria_id = antiga.id) AS usos
      FROM public.denuncias_categorias antiga
     WHERE lower(btrim(antiga.nome)) = 'outro'
       AND antiga.ativo
       AND EXISTS (
         SELECT 1 FROM public.denuncias_categorias nova
          WHERE nova.empresa_id = antiga.empresa_id
            AND lower(btrim(nova.nome)) = 'outros'
            AND nova.ativo
       )
  LOOP
    IF r.usos = 0 THEN
      UPDATE public.denuncias_categorias SET ativo = false WHERE id = r.id;
      v_desactivadas := v_desactivadas + 1;
    ELSE
      v_mantidas := v_mantidas + 1;
      RAISE WARNING
        'Empresa %: «Outro» tem % denúncia(s) e fica activa ao lado de «Outros». Reclassificar é decisão do comité.',
        r.empresa_id, r.usos;
    END IF;
  END LOOP;

  RAISE NOTICE '«Outro» desactivada em % empresa(s); mantida em % por ter relatos.',
    v_desactivadas, v_mantidas;
END $$;
