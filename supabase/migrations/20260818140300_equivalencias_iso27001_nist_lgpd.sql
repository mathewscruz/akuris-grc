-- Equivalências entre ISO/IEC 27001:2022, NIST CSF 2.0 e LGPD.
--
-- O mapeamento é feito por CÓDIGO do requisito, não por id: os frameworks são
-- globais e os ids variam entre ambientes, mas o código de um controlo da norma
-- não muda. Assim a migration é idempotente e funciona em qualquer base que
-- tenha os frameworks carregados — e não faz nada onde eles ainda não existem.
--
-- As correspondências seguem os anexos de mapeamento publicados (NIST CSF 2.0
-- Informative References para a ISO 27001, e a leitura corrente da LGPD contra
-- os controlos organizacionais do Anexo A). Onde o controlo cobre só parte do
-- requisito, a relação é `parcial` e a herança nunca promove a `conforme`.

BEGIN;

CREATE TEMP TABLE mapa (fw_a text, cod_a text, fw_b text, cod_b text, relacao text) ON COMMIT DROP;

INSERT INTO mapa (fw_a, cod_a, fw_b, cod_b, relacao) VALUES
  -- ISO 27001 <-> NIST CSF 2.0
  ('ISO/IEC 27001', 'A.5.1',  'NIST CSF', 'GV.OC', 'equivalente'),
  ('ISO/IEC 27001', 'A.5.15', 'NIST CSF', 'PR.AA', 'equivalente'),
  ('ISO/IEC 27001', 'A.8.13', 'NIST CSF', 'ID.AM', 'parcial'),
  -- ISO 27001 <-> LGPD
  ('ISO/IEC 27001', 'A.5.15', 'LGPD', 'Art.46', 'parcial'),
  ('ISO/IEC 27001', 'A.8.7',  'LGPD', 'Art.46', 'parcial'),
  ('ISO/IEC 27001', 'A.5.1',  'LGPD', 'Art.41', 'parcial'),
  -- NIST CSF <-> LGPD
  ('NIST CSF', 'ID.AM', 'LGPD', 'Art.37', 'equivalente');

INSERT INTO public.gap_analysis_requirement_crosswalk (requisito_a, requisito_b, relacao, observacao)
SELECT ra.id, rb.id, m.relacao,
       m.fw_a || ' ' || m.cod_a || ' <-> ' || m.fw_b || ' ' || m.cod_b
FROM mapa m
JOIN gap_analysis_frameworks fa ON fa.nome = m.fw_a AND fa.empresa_id IS NULL
JOIN gap_analysis_requirements ra ON ra.framework_id = fa.id AND ra.codigo = m.cod_a
JOIN gap_analysis_frameworks fb ON fb.nome = m.fw_b AND fb.empresa_id IS NULL
JOIN gap_analysis_requirements rb ON rb.framework_id = fb.id AND rb.codigo = m.cod_b
ON CONFLICT DO NOTHING;

COMMIT;
