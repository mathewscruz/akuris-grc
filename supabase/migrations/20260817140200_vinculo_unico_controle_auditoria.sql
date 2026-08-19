-- Uma só verdade para "este controlo está no âmbito desta auditoria".
--
-- Havia dois caminhos independentes a representar a mesma relação:
--   * `controles_auditorias` — escrito pelo passo "Vinculações" do formulário do
--     controlo, e lido pelo filtro por auditoria da listagem de Controles, pelo
--     separador "Auditorias" do detalhe e pelas contagens da aba Auditorias;
--   * `auditoria_itens.controle_vinculado_id` — escrito por "Importar Controles"
--     dentro da auditoria, e lido pela lista de itens de verificação.
--
-- Nenhum via o outro: depois de importar controlos para uma auditoria, filtrar a
-- listagem de Controles por essa auditoria devolvia zero e o detalhe do controlo
-- mostrava "Auditorias (0)".
--
-- Decisão: `controles_auditorias` é a tabela canónica do **âmbito**, e
-- `auditoria_itens` continua a ser o **papel de trabalho** (estado, prazo,
-- responsável, evidência). Um item que aponta para um controlo passa a manter o
-- vínculo de âmbito automaticamente, do lado do banco — assim vale para qualquer
-- cliente e não fica dependente de cada ecrã se lembrar de escrever nas duas.

CREATE OR REPLACE FUNCTION public.auditoria_itens_sincroniza_vinculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Item deixou de apontar para um controlo (ou foi removido): retira o vínculo
  -- de âmbito, desde que nenhum outro item da mesma auditoria ainda o refira.
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.controle_vinculado_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.controle_vinculado_id IS DISTINCT FROM OLD.controle_vinculado_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auditoria_itens ai
       WHERE ai.auditoria_id = OLD.auditoria_id
         AND ai.controle_vinculado_id = OLD.controle_vinculado_id
         AND ai.id <> OLD.id
    ) THEN
      DELETE FROM public.controles_auditorias
       WHERE auditoria_id = OLD.auditoria_id
         AND controle_id = OLD.controle_vinculado_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.controle_vinculado_id IS NOT NULL THEN
    INSERT INTO public.controles_auditorias (controle_id, auditoria_id, tipo_relacao)
    VALUES (NEW.controle_vinculado_id, NEW.auditoria_id, 'testado_em')
    ON CONFLICT (controle_id, auditoria_id) DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_itens_sincroniza_vinculo_trg ON public.auditoria_itens;
CREATE TRIGGER auditoria_itens_sincroniza_vinculo_trg
  AFTER INSERT OR UPDATE OF controle_vinculado_id, auditoria_id OR DELETE
  ON public.auditoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_itens_sincroniza_vinculo();

-- Recupera o que os dois caminhos já criaram em separado.
INSERT INTO public.controles_auditorias (controle_id, auditoria_id, tipo_relacao)
SELECT DISTINCT ai.controle_vinculado_id, ai.auditoria_id, 'testado_em'
  FROM public.auditoria_itens ai
 WHERE ai.controle_vinculado_id IS NOT NULL
ON CONFLICT (controle_id, auditoria_id) DO NOTHING;

COMMENT ON FUNCTION public.auditoria_itens_sincroniza_vinculo() IS
  'Mantém controles_auditorias (âmbito) alinhado com os itens de auditoria que referenciam um controlo.';
COMMENT ON TABLE public.controles_auditorias IS
  'Âmbito: que controlos entram em que auditoria. Fonte única — auditoria_itens sincroniza por gatilho.';
