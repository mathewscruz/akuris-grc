/**
 * Ligação risco ↔ controlos reais (requisitos dos frameworks) e justificação
 * de risco na SoA. Português de Portugal no PT.
 */
export const riscosControles = {
  pt: {
    riscosControles: {
      vincular: {
        titulo: 'Vincular controlos ao risco',
        buscar: 'Pesquisar por código ou nome (ex.: A.5.1, políticas)',
        selecionados: '{count} requisito(s) seleccionado(s)',
        todosFrameworks: 'Todos os frameworks',
        semFrameworks: 'Ainda não existe nenhum framework activo no Gap Analysis desta empresa.',
        semResultados: 'Nenhum requisito encontrado para esta pesquisa.',
        salvar: 'Guardar ligações',
        sucessoTitulo: 'Controlos vinculados',
        sucessoDesc: '{count} requisito(s) ligado(s) a este risco.',
        erroTitulo: 'Não foi possível guardar as ligações',
        erroDesc: 'Tente novamente.',
      },
      aba: {
        vinculados: '{count} controlo(s) vinculado(s)',
        vincular: 'Vincular controlo',
        vazio: 'Ainda não há controlos vinculados. Ligue este risco aos requisitos dos frameworks activos.',
        abrirNoGap: 'Abrir no Gap Analysis',
        notaTexto: 'Nota descritiva (texto livre). A fonte de verdade do cálculo são os requisitos vinculados.',
      },
      residual: {
        titulo: 'Residual sugerido pelos controlos',
        conta:
          '{total} controlo(s) vinculado(s): {conforme} conforme, {parcial} parcial, {naoConforme} não conforme, {naoAvaliado} por avaliar, {naoAplicavel} N/A (excluído) = {fator}% de mitigação.',
        avaliado: 'Residual avaliado manualmente: score {score}.',
        aplicar: 'Aplicar sugestão',
        naoImposto: 'Sugestão — o valor avaliado manualmente mantém-se se não aplicar.',
        aplicadoTitulo: 'Residual actualizado',
        aplicadoDesc: 'Novo score residual: {score}.',
        erroTitulo: 'Não foi possível aplicar a sugestão',
        desactualizado: 'Residual desactualizado: a conformidade dos controlos mudou.',
        aceiteReavaliar: 'O aceite formal deve ser reavaliado — o residual sugerido subiu de faixa.',
      },
      soa: {
        colRiscos: 'Riscos',
        semRisco: 'Sem justificação de risco',
        gerarJustificacao: 'Gerar justificação a partir dos riscos',
        justificacaoGerada: 'Justificação gerada para {count} controlo(s). Guarde para confirmar.',
        semRiscosSelecionados: 'Nenhum dos controlos seleccionados tem riscos associados.',
        justificacaoTexto: 'Incluído para tratar {count} risco(s) identificado(s): {riscos}.',
      },
      requisito: {
        riscosDependentes: '{count} risco(s) dependem deste requisito',
      },
    },
  },
  en: {
    riscosControles: {
      vincular: {
        titulo: 'Link controls to risk',
        buscar: 'Search by code or name (e.g. A.5.1, policies)',
        selecionados: '{count} requirement(s) selected',
        todosFrameworks: 'All frameworks',
        semFrameworks: 'There is no active Gap Analysis framework for this company yet.',
        semResultados: 'No requirement matches this search.',
        salvar: 'Save links',
        sucessoTitulo: 'Controls linked',
        sucessoDesc: '{count} requirement(s) linked to this risk.',
        erroTitulo: 'Could not save the links',
        erroDesc: 'Please try again.',
      },
      aba: {
        vinculados: '{count} linked control(s)',
        vincular: 'Link control',
        vazio: 'No controls linked yet. Link this risk to requirements of the active frameworks.',
        abrirNoGap: 'Open in Gap Analysis',
        notaTexto: 'Descriptive note (free text). The source of truth for the calculation is the linked requirements.',
      },
      residual: {
        titulo: 'Residual suggested by controls',
        conta:
          '{total} linked control(s): {conforme} compliant, {parcial} partial, {naoConforme} non-compliant, {naoAvaliado} not evaluated, {naoAplicavel} N/A (excluded) = {fator}% mitigation.',
        avaliado: 'Manually assessed residual: score {score}.',
        aplicar: 'Apply suggestion',
        naoImposto: 'Suggestion only — your assessed value stays unless you apply it.',
        aplicadoTitulo: 'Residual updated',
        aplicadoDesc: 'New residual score: {score}.',
        erroTitulo: 'Could not apply the suggestion',
        desactualizado: 'Residual outdated: control compliance has changed.',
        aceiteReavaliar: 'The formal acceptance should be reviewed — the suggested residual moved up a band.',
      },
      soa: {
        colRiscos: 'Risks',
        semRisco: 'No risk justification',
        gerarJustificacao: 'Generate justification from risks',
        justificacaoGerada: 'Justification generated for {count} control(s). Save to confirm.',
        semRiscosSelecionados: 'None of the selected controls has associated risks.',
        justificacaoTexto: 'Included to treat {count} identified risk(s): {riscos}.',
      },
      requisito: {
        riscosDependentes: '{count} risk(s) depend on this requirement',
      },
    },
  },
};
