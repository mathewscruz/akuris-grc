/**
 * Varredura final PT→EN — área: config.
 * Chaves criadas para substituir textos fixos em português remanescentes.
 */
export const sweepConfig = {
  pt: {
    sweepConfig: {
      traducaoFrameworks: {
        toastTranslateDone: 'Tradução concluída: {nome}',
        toastGuidanceDone: 'Orientações em inglês atualizadas: {nome}',
        intro: 'Traduz para inglês títulos, descrições, categorias e textos de apoio dos requisitos. O conteúdo em português continua como base — o inglês é exibido apenas quando o idioma ativo é EN.',
        pendingCount: '{count} requisito(s) pendente(s).',
        progressLine: '{traduzidos} de {total} requisitos · orientações EN: {guidanceEn} de {total}',
        btnTranslating: 'Traduzindo…',
        btnTranslated: 'Traduzido',
        btnTranslate: 'Traduzir para EN',
        btnGenerating: 'Gerando…',
        btnGuidanceOk: 'Orientações OK',
        btnGuidanceTranslate: 'Traduzir orientações',
      },
      financeiroIA: {
        labelResumo: 'Resumo',
        labelDiagnostico: 'Diagnóstico',
        labelRecomendacoes: 'Recomendações',
        labelAlertas: 'Alertas',
        labelConclusao: 'Conclusão',
      },
      integracoes: {
        webhooks: {
          payloadExampleTitle: 'Título do incidente',
        },
        inboundWebhooks: {
          payloadExamples: {
            incidentes: {
              title: 'Alerta de Intrusão Detectado',
              description: 'Tentativa de acesso não autorizado ao servidor de produção',
            },
            riscos: {
              title: 'Vulnerabilidade CVE-2024-1234',
              description: 'Vulnerabilidade crítica detectada no componente X',
              probability: 'Possível',
              impact: 'Alto',
            },
            ativos: {
              type: 'Servidor',
              description: 'Novo servidor detectado na rede',
            },
            controles: {
              title: 'Verificação de Firewall',
              description: 'Controle de monitoramento de regras de firewall',
            },
            denuncias: {
              title: 'Relato de Irregularidade',
              description: 'Relato recebido pelo canal externo de denúncias',
            },
            default: {
              title: 'Evento de teste',
              description: 'Teste via Akuris',
            },
          },
        },
      },
    },
  },
  en: {
    sweepConfig: {
      traducaoFrameworks: {
        toastTranslateDone: 'Translation completed: {nome}',
        toastGuidanceDone: 'English guidance updated: {nome}',
        intro: 'Translates requirement titles, descriptions, categories and supporting text into English. Portuguese content remains the base — English is displayed only when the active language is EN.',
        pendingCount: '{count} pending requirement(s).',
        progressLine: '{traduzidos} of {total} requirements · EN guidance: {guidanceEn} of {total}',
        btnTranslating: 'Translating…',
        btnTranslated: 'Translated',
        btnTranslate: 'Translate to EN',
        btnGenerating: 'Generating…',
        btnGuidanceOk: 'Guidance OK',
        btnGuidanceTranslate: 'Translate guidance',
      },
      financeiroIA: {
        labelResumo: 'Summary',
        labelDiagnostico: 'Diagnosis',
        labelRecomendacoes: 'Recommendations',
        labelAlertas: 'Alerts',
        labelConclusao: 'Conclusion',
      },
      integracoes: {
        webhooks: {
          payloadExampleTitle: 'Incident title',
        },
        inboundWebhooks: {
          payloadExamples: {
            incidentes: {
              title: 'Intrusion Alert Detected',
              description: 'Unauthorized access attempt on production server',
            },
            riscos: {
              title: 'Vulnerability CVE-2024-1234',
              description: 'Critical vulnerability detected in component X',
              probability: 'Possible',
              impact: 'High',
            },
            ativos: {
              type: 'Server',
              description: 'New server detected on the network',
            },
            controles: {
              title: 'Firewall Verification',
              description: 'Monitoring control for firewall rules',
            },
            denuncias: {
              title: 'Irregularity Report',
              description: 'Report received via external whistleblowing channel',
            },
            default: {
              title: 'Test event',
              description: 'Test via Akuris',
            },
          },
        },
      },
    },
  },
};
