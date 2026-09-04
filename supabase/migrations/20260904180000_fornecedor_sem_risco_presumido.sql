-- Um fornecedor nunca avaliado não pode nascer classificado como baixo risco.
-- A ausência de evidência passa a ser NULL e a interface a apresenta como
-- "Nunca avaliado". Preservamos o risco baixo quando existe qualquer avaliação
-- de due diligence, pois nesse caso ele pode ter sido uma decisão humana.

ALTER TABLE public.fornecedores
  ALTER COLUMN avaliacao_risco DROP DEFAULT;

UPDATE public.fornecedores f
   SET avaliacao_risco = NULL
 WHERE avaliacao_risco = 'baixo'
   AND NOT EXISTS (
     SELECT 1
       FROM public.due_diligence_assessments a
      WHERE a.empresa_id = f.empresa_id
        AND (
          a.fornecedor_id = f.id
          OR (
            a.fornecedor_id IS NULL
            AND f.email IS NOT NULL
            AND lower(trim(a.fornecedor_email)) = lower(trim(f.email))
          )
        )
   );

COMMENT ON COLUMN public.fornecedores.avaliacao_risco IS
  'Risco inerente declarado. NULL significa que o fornecedor ainda não foi avaliado; nunca deve ser interpretado como baixo risco.';
