-- A base legal do ROPA estava em texto livre e o produto lia-a como vocabulário.
--
-- Medido numa cópia da base de produção: dos 7 registos ROPA reais, **zero**
-- casavam com qualquer chave do vocabulário. O ecrã marcava os sete a vermelho,
-- "Base fora da lei aplicável", e o filtro de base legal não devolvia nenhum.
-- Nenhuma das duas coisas era verdade — as bases estavam certas, só não estavam
-- em forma de dado:
--
--   "Execução de contrato (Art. 7º, V) para comunicações obrigatórias (boleto,
--    notas, avisos); Legítimo Interesse (Art. 7º, IX) para comunicações de
--    relacionamento e retenção preventiva."
--
-- Isso é DUAS bases, cada uma com o seu âmbito. O importador gravava a frase
-- inteira num campo de vocabulário controlado.
--
-- ---------------------------------------------------------------------------
-- Uma implementação, não duas
-- ---------------------------------------------------------------------------
-- A função vive aqui, na base, e é ela que a importação passa a chamar. O
-- equivalente em TypeScript (`src/lib/base-legal-texto.ts`) serve a
-- pré-visualização no ecrã, e há um teste que exige que os dois concordem sobre
-- as frases reais — porque duas implementações que divergem em silêncio é
-- exatamente o defeito que este produto já teve noutros sítios.

CREATE OR REPLACE FUNCTION public.ropa_chave_da_base_legal(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- A ordem é a especificidade: "cumprimento de obrigação legal" contém
  -- "legal", e "consentimento explícito" contém "consentimento".
  SELECT CASE
    WHEN p_texto ~* 'consentimento\s+expl[ií]cito'                      THEN 'consentimento_explicito'
    WHEN p_texto ~* 'cumprimento\s+de\s+obriga[cç][aã]o|obriga[cç][aã]o\s+(legal|regulat[oó]ria)' THEN 'cumprimento_obrigacao'
    WHEN p_texto ~* 'direito\s+laboral|seguran[cç]a\s+social'           THEN 'obrigacao_trabalho'
    WHEN p_texto ~* 'execu[cç][aã]o\s+d[eo]\s+contrato|procedimentos\s+preliminares' THEN 'execucao_contrato'
    WHEN p_texto ~* 'exerc[ií]cio\s+regular\s+de\s+direitos|processo\s+judicial' THEN 'exercicio_direitos'
    WHEN p_texto ~* 'prote[cç][aã]o\s+d[ao]\s+vida|incolumidade\s+f[ií]sica' THEN 'protecao_vida'
    WHEN p_texto ~* 'tutela\s+d[ao]\s+sa[uú]de'                         THEN 'tutela_saude'
    WHEN p_texto ~* 'prote[cç][aã]o\s+ao\s+cr[eé]dito'                  THEN 'protecao_credito'
    WHEN p_texto ~* 'preven[cç][aã]o\s+[aà]\s+fraude'                   THEN 'prevencao_fraude'
    WHEN p_texto ~* 'pol[ií]ticas\s+p[uú]blicas'                        THEN 'politicas_publicas'
    WHEN p_texto ~* 'interesse\s+p[uú]blico'                            THEN 'interesse_publico'
    WHEN p_texto ~* '[oó]rg[aã]o\s+de\s+pesquisa|estudo\s+por\s+[oó]rg[aã]o' THEN 'estudo_pesquisa'
    WHEN p_texto ~* 'leg[ií]timo\s+interesse|interesse\s+leg[ií]timo'   THEN 'legitimo_interesse'
    WHEN p_texto ~* 'consentimento'                                     THEN 'consentimento'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.ropa_chave_da_base_legal(text) IS
  'Chave do vocabulário para um fragmento de base legal escrito à mão. Espelhada em src/lib/base-legal-texto.ts, com teste a exigir que concordem.';

-- ---------------------------------------------------------------------------
-- O backfill
-- ---------------------------------------------------------------------------
-- Separa por `;` e por ` / `, mapeia cada fragmento, e guarda o fragmento
-- ORIGINAL como justificativa — é ele que o auditor lê, com a citação do artigo
-- e o âmbito. Nada do que o cliente escreveu se perde.
--
-- Só toca em registos cuja base legal ainda NÃO está em forma de vocabulário:
-- quem já tem `legitimo_interesse` gravado fica como está.
WITH candidatos AS (
  SELECT r.id, r.empresa_id, r.base_legal
    FROM public.ropa_registros r
   WHERE r.base_legal IS NOT NULL
     AND btrim(r.base_legal) <> ''
     AND public.ropa_chave_da_base_legal(r.base_legal) IS DISTINCT FROM r.base_legal
     AND r.base_legal NOT IN (
       'consentimento','cumprimento_obrigacao','politicas_publicas','estudo_pesquisa',
       'execucao_contrato','exercicio_direitos','protecao_vida','tutela_saude',
       'legitimo_interesse','protecao_credito','prevencao_fraude','interesse_publico',
       'consentimento_explicito','obrigacao_trabalho')
),
fragmentos AS (
  SELECT c.id, c.empresa_id,
         btrim(f.fragmento) AS fragmento,
         f.pos
    FROM candidatos c,
         LATERAL regexp_split_to_table(c.base_legal, '\s*(?:;|\s/\s)\s*')
              WITH ORDINALITY AS f(fragmento, pos)
   WHERE btrim(f.fragmento) <> ''
),
mapeados AS (
  SELECT id, empresa_id, fragmento,
         public.ropa_chave_da_base_legal(fragmento) AS chave,
         row_number() OVER (PARTITION BY id, public.ropa_chave_da_base_legal(fragmento) ORDER BY pos) AS rn,
         pos
    FROM fragmentos
)
INSERT INTO public.ropa_bases_legais (ropa_id, empresa_id, base_legal, justificativa, ordem)
SELECT id, empresa_id, chave, fragmento, (pos - 1)::int
  FROM mapeados
 WHERE chave IS NOT NULL
   AND rn = 1          -- a mesma base repetida no campo é redundância de escrita
ON CONFLICT (ropa_id, base_legal) DO UPDATE
  SET justificativa = COALESCE(EXCLUDED.justificativa, public.ropa_bases_legais.justificativa);

-- As linhas que o backfill de `20260819200000` criou com a FRASE INTEIRA como
-- `base_legal` deixam de fazer sentido assim que as bases reais existem.
DELETE FROM public.ropa_bases_legais b
 WHERE public.ropa_chave_da_base_legal(b.base_legal) IS DISTINCT FROM b.base_legal
   AND b.base_legal NOT IN (
     'consentimento','cumprimento_obrigacao','politicas_publicas','estudo_pesquisa',
     'execucao_contrato','exercicio_direitos','protecao_vida','tutela_saude',
     'legitimo_interesse','protecao_credito','prevencao_fraude','interesse_publico',
     'consentimento_explicito','obrigacao_trabalho')
   AND EXISTS (SELECT 1 FROM public.ropa_bases_legais o
                WHERE o.ropa_id = b.ropa_id AND o.id <> b.id);

-- O gatilho de `20260819200000` reprojeta `ropa_registros.base_legal` a partir
-- da base de menor ordem. Um toque para o forçar a correr em cada registo.
UPDATE public.ropa_bases_legais SET ordem = ordem WHERE true;
