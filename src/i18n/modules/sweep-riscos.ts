/**
 * Varredura final PT→EN — área: riscos, gap analysis, controles, auditorias, governança, incidentes.
 * Chaves criadas para substituir textos fixos em português remanescentes.
 */
export const sweepRiscos = {
  pt: {
    sweepRiscos: {
      comum: {
        remover: 'Remover',
      },
      riscos: {
        matrizForm: {
          corAria: 'Cor {cor}',
          cancelarEdicao: 'Cancelar edição',
          nomeMatrizLabel: 'Nome da matriz',
          soma: 'Soma',
          somaDesc: 'Resultado pode variar de 2 a Pmax + Imax',
          adicionarNivel: 'Adicionar nível',
          adicionarNivelRisco: 'Adicionar nível de risco',
          faixasEyebrow: 'Faixas',
          apetiteDescPre: 'Riscos com score acima do nível escolhido são considerados',
          apetiteDescStrong: 'acima do apetite',
          apetiteDescPost: 'e exigem tratamento ou aceite formal. Define a linha de apetite no gráfico e o filtro "Acima do apetite".',
          ateNivel: 'Até {nivel}',
          nivelN: 'Nível {n}',
          alteracoesAfetam: 'Alterações afetam novos cálculos de risco.',
          erroMinMaior: 'O nível "{nivel}" tem valor mínimo maior que o máximo',
          erroSobreposicao: 'Sobreposição detectada entre "{nivelA}" (max: {max}) e "{nivelB}" (min: {min})',
          erroGap: 'Gap detectado: valores {de} a {ate} não estão cobertos por nenhum nível',
        },
        wizard: {
          novoRiscoTitulo: 'Novo Risco: {nome}',
          descricaoDefault: 'Risco identificado com nível {nivel}',
          notifMessage: 'O risco "{nome}" foi enviado para sua aprovação de aceite.',
          exposicaoEstimada: 'Exposição estimada:',
          exposicaoDesc: '(impacto × probabilidade). Usada para priorizar riscos por valor, não só por cor.',
          aceitePendente: 'Aceite pendente de aprovação',
          aceiteAprovado: 'Aceite aprovado',
          aceiteRejeitado: 'Aceite rejeitado — você pode reenviar',
          etapa: 'Etapa',
          de: 'de',
          proxima: 'Próxima',
        },
      },
    },
  },
  en: {
    sweepRiscos: {
      comum: {
        remover: 'Remove',
      },
      riscos: {
        matrizForm: {
          corAria: 'Color {cor}',
          cancelarEdicao: 'Cancel edit',
          nomeMatrizLabel: 'Matrix name',
          soma: 'Sum',
          somaDesc: 'Result can range from 2 to Pmax + Imax',
          adicionarNivel: 'Add level',
          adicionarNivelRisco: 'Add risk level',
          faixasEyebrow: 'Ranges',
          apetiteDescPre: 'Risks with a score above the selected level are considered',
          apetiteDescStrong: 'above risk appetite',
          apetiteDescPost: 'and require treatment or formal acceptance. Defines the appetite line on the chart and the "Above appetite" filter.',
          ateNivel: 'Up to {nivel}',
          nivelN: 'Level {n}',
          alteracoesAfetam: 'Changes affect new risk calculations.',
          erroMinMaior: 'Level "{nivel}" has a minimum value greater than the maximum',
          erroSobreposicao: 'Overlap detected between "{nivelA}" (max: {max}) and "{nivelB}" (min: {min})',
          erroGap: 'Gap detected: values {de} to {ate} are not covered by any level',
        },
        wizard: {
          novoRiscoTitulo: 'New Risk: {nome}',
          descricaoDefault: 'Risk identified at level {nivel}',
          notifMessage: 'The risk "{nome}" was sent for your acceptance approval.',
          exposicaoEstimada: 'Estimated exposure:',
          exposicaoDesc: '(impact × probability). Used to prioritize risks by value, not only by color.',
          aceitePendente: 'Acceptance pending approval',
          aceiteAprovado: 'Acceptance approved',
          aceiteRejeitado: 'Acceptance rejected — you can resubmit',
          etapa: 'Step',
          de: 'of',
          proxima: 'Next',
        },
      },
    },
  },
};
