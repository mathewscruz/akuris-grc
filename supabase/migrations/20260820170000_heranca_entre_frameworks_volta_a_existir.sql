-- A herança entre frameworks volta a existir: 0 linhas viram 20.
--
-- `gap_analysis_requirement_crosswalk` estava VAZIA. A migration de 18/08 que
-- a devia semear casava por código, e os códigos não batiam com o catálogo:
--
--     seed diz 'GV.OC'   ->  o catálogo tem 'GV.OC-01' ... 'GV.OC-05'
--     seed diz 'PR.AA'   ->  o catálogo tem 'PR.AA-01' ... 'PR.AA-06'
--     seed diz 'ID.AM'   ->  o catálogo tem 'ID.AM-01' ... 'ID.AM-08'
--     seed diz 'Art.46'  ->  o catálogo tem 'Art. 46'   (com espaço)
--
-- Nenhum dos sete pares casou, o INSERT ... SELECT inseriu zero linhas, e
-- ninguém reparou porque `HerancaCrossFramework` faz `if (propostas.length
-- === 0) return null`: sem equivalências a secção não se desenha e não há
-- estado vazio a dizer que existe.
--
-- O custo disto não é cosmético. Responder à ISO/IEC 27001 e depois à LGPD é
-- responder duas vezes às mesmas perguntas — é exactamente o trabalho que a
-- Vanta e a Drata poupam ao cliente, e é o argumento que este módulo vende.
--
-- ------------------------------------------------------------------ critério
--
-- Só entram pares que se sustentam no TEXTO dos dois requisitos, e a relação é
-- conservadora:
--
--   `equivalente` — os dois pedem a mesma coisa; a herança pode propor o mesmo
--                   status, incluindo `conforme`.
--   `parcial`     — um cobre parte do outro; a herança nunca promove a
--                   `conforme`, propõe `parcial`.
--
-- Na dúvida, `parcial`. Uma equivalência errada faz o cliente declarar-se
-- conforme numa coisa que não cumpre, e é o auditor que descobre.
--
-- Isto não é o cruzamento completo — é o núcleo defensável entre os três
-- frameworks que mais se sobrepõem no catálogo. O mapeamento integral
-- ISO 27001 <-> NIST CSF 2.0 são centenas de pares e é trabalho de conteúdo,
-- não de migration.

BEGIN;

CREATE TEMP TABLE mapa (fw_a text, cod_a text, fw_b text, cod_b text, relacao text, nota text)
  ON COMMIT DROP;

INSERT INTO mapa (fw_a, cod_a, fw_b, cod_b, relacao, nota) VALUES
  -- ===================== ISO/IEC 27001:2022 <-> NIST CSF 2.0 =============
  ('ISO/IEC 27001', 'A.5.1',  'NIST CSF', 'GV.PO-01', 'equivalente',
   'Política de segurança da informação aprovada pela direção e comunicada.'),
  ('ISO/IEC 27001', 'A.5.9',  'NIST CSF', 'ID.AM-01', 'parcial',
   'A.5.9 inventaria todos os ativos de informação; ID.AM-01 cobre o hardware.'),
  ('ISO/IEC 27001', 'A.5.15', 'NIST CSF', 'PR.AA-05', 'parcial',
   'A.5.15 é a política de controlo de acesso; PR.AA-05 é a autenticação.'),
  ('ISO/IEC 27001', 'A.5.7',  'NIST CSF', 'ID.RA-02', 'equivalente',
   'Recolha e uso de inteligência de ameaças.'),
  ('ISO/IEC 27001', 'A.5.24', 'NIST CSF', 'RS.MA-01', 'equivalente',
   'Plano de resposta a incidentes preparado e executado.'),
  ('ISO/IEC 27001', 'A.8.13', 'NIST CSF', 'PR.DS-11', 'equivalente',
   'Cópias de segurança criadas, protegidas e testadas.'),
  ('ISO/IEC 27001', 'A.8.16', 'NIST CSF', 'DE.CM-01', 'parcial',
   'A.8.16 monitoriza redes, sistemas e aplicações; DE.CM-01 é a rede.'),

  -- ===================== ISO/IEC 27001:2022 <-> LGPD =====================
  ('ISO/IEC 27001', 'A.5.15', 'LGPD', 'Art. 46', 'parcial',
   'Controlo de acesso é uma das medidas técnicas do art. 46, não todas.'),
  ('ISO/IEC 27001', 'A.8.7',  'LGPD', 'Art. 46', 'parcial',
   'Proteção contra malware é uma das medidas técnicas do art. 46.'),
  ('ISO/IEC 27001', 'A.5.34', 'LGPD', 'Art. 46', 'parcial',
   'A.5.34 trata privacidade e proteção de dados pessoais.'),
  ('ISO/IEC 27001', 'A.5.24', 'LGPD', 'Art. 48', 'parcial',
   'A gestão de incidentes sustenta a comunicação à ANPD, mas não a esgota: o prazo e o conteúdo da comunicação são da lei.'),
  ('ISO/IEC 27001', 'A.5.1',  'LGPD', 'Art. 50', 'parcial',
   'A política de SI é parte das regras de boas práticas e governança.'),
  ('ISO/IEC 27001', 'A.5.10', 'LGPD', 'Art. 47', 'parcial',
   'Uso aceitável e proteção da informação, que se mantém após o término do tratamento.'),

  -- ===================== NIST CSF 2.0 <-> LGPD ===========================
  ('NIST CSF', 'ID.AM-04', 'LGPD', 'Art. 37', 'parcial',
   'O mapeamento de dados alimenta o registo das operações de tratamento.'),
  ('NIST CSF', 'PR.AA-05', 'LGPD', 'Art. 46', 'parcial',
   'Autenticação robusta é uma das medidas de segurança exigidas.'),
  ('NIST CSF', 'RS.MA-01', 'LGPD', 'Art. 48', 'parcial',
   'O plano de resposta sustenta a comunicação do incidente.'),
  ('NIST CSF', 'GV.OC-04', 'LGPD', 'Art. 1º', 'parcial',
   'Requisitos legais e regulatórios compreendidos e geridos.'),

  -- ===================== SOC 2 <-> ISO/IEC 27001 =========================
  ('SOC 2 Type II', 'CC6.1', 'ISO/IEC 27001', 'A.5.15', 'parcial',
   'CC6.1 é a proteção lógica de acesso; A.5.15 é a política que a rege.'),
  ('SOC 2 Type II', 'CC7.3', 'ISO/IEC 27001', 'A.5.24', 'parcial',
   'Avaliação e resposta a incidentes de segurança.'),
  ('SOC 2 Type II', 'CC9.2', 'ISO/IEC 27001', 'A.5.19', 'equivalente',
   'Gestão do risco de fornecedores e terceiros.');

-- Um par vale nos dois sentidos: quem responde à ISO herda para o NIST e
-- vice-versa. A tabela guarda o par uma vez; aqui geramos os dois lados.
INSERT INTO public.gap_analysis_requirement_crosswalk (requisito_a, requisito_b, relacao, observacao)
SELECT ra.id, rb.id, m.relacao, m.nota
  FROM mapa m
  JOIN public.gap_analysis_frameworks   fa ON fa.nome = m.fw_a AND fa.empresa_id IS NULL
  JOIN public.gap_analysis_requirements ra ON ra.framework_id = fa.id AND ra.codigo = m.cod_a
  JOIN public.gap_analysis_frameworks   fb ON fb.nome = m.fw_b AND fb.empresa_id IS NULL
  JOIN public.gap_analysis_requirements rb ON rb.framework_id = fb.id AND rb.codigo = m.cod_b
ON CONFLICT DO NOTHING;

INSERT INTO public.gap_analysis_requirement_crosswalk (requisito_a, requisito_b, relacao, observacao)
SELECT rb.id, ra.id, m.relacao, m.nota
  FROM mapa m
  JOIN public.gap_analysis_frameworks   fa ON fa.nome = m.fw_a AND fa.empresa_id IS NULL
  JOIN public.gap_analysis_requirements ra ON ra.framework_id = fa.id AND ra.codigo = m.cod_a
  JOIN public.gap_analysis_frameworks   fb ON fb.nome = m.fw_b AND fb.empresa_id IS NULL
  JOIN public.gap_analysis_requirements rb ON rb.framework_id = fb.id AND rb.codigo = m.cod_b
ON CONFLICT DO NOTHING;

-- A conta tem de fechar: se um código deixar de existir numa equalização
-- futura, o par desaparece em silêncio outra vez. Aqui o silêncio acaba.
DO $$
DECLARE
  v_pares int;
  v_linhas int;
BEGIN
  SELECT count(*) INTO v_pares FROM mapa;
  SELECT count(*) INTO v_linhas FROM public.gap_analysis_requirement_crosswalk;
  IF v_linhas < v_pares THEN
    RAISE EXCEPTION 'Crosswalk ficou com % linhas para % pares: existe codigo no seed que nao existe no catalogo', v_linhas, v_pares;
  END IF;
  RAISE NOTICE 'Crosswalk: % pares -> % linhas (dois sentidos)', v_pares, v_linhas;
END $$;

COMMIT;
