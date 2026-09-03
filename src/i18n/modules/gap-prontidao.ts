/**
 * «Já posso marcar a auditoria?» — a última pergunta do percurso.
 *
 * O desfecho muda com a família do framework, e não é detalhe de redacção:
 * mandar quem trabalha a LGPD contratar um organismo certificador é mandá-la
 * procurar uma coisa que não existe. As quatro variantes seguem `fimDoPercurso`,
 * para não haver uma segunda tabela a discordar da primeira.
 */
const PT = {
  titulo: 'Prontidão para a auditoria',

  /* Ainda não. Diz onde está, sem adjectivos: o número é que fala. */
  aindaNao: '{feitos} de {total} requisitos aplicáveis estão conformes. Falta fechar o que está abaixo antes de marcar.',

  pronto_certificado: 'Todos os requisitos aplicáveis estão conformes. Pode contratar um organismo certificador acreditado e marcar a auditoria de certificação.',
  pronto_relatorio: 'Todos os requisitos aplicáveis estão conformes. Pode contratar o auditor independente que emite o relatório.',
  pronto_lei: 'Todos os requisitos aplicáveis estão conformes. Consegue demonstrar a sua conformidade à autoridade e aos seus clientes — não existe certificado para esta legislação.',
  pronto_referencial: 'Todos os requisitos aplicáveis estão conformes. Este referencial não tem auditoria externa formal: o que existe é a avaliação que acabou de completar.',

  bloqueio: {
    nao_avaliado: {
      one: '1 requisito ainda não foi avaliado — sem ele, não sabe onde está',
      other: '{count} requisitos ainda não foram avaliados — sem eles, não sabe onde está',
    },
    nao_conforme: {
      one: '1 requisito não conforme',
      other: '{count} requisitos não conformes',
    },
    parcial: {
      one: '1 requisito parcialmente conforme',
      other: '{count} requisitos parcialmente conformes',
    },
    /* O auditor não avalia o que a empresa afirma: avalia o que ela mostra. */
    conforme_sem_prova: {
      one: '1 requisito conforme sem nenhuma prova anexada',
      other: '{count} requisitos conformes sem nenhuma prova anexada',
    },
  },

  /*
     A ressalva fica também no estado «pronto», e é de propósito.

     O produto vê o que está registado nele. Dizer «está pronto» sem isto seria
     transformar um registo interno numa garantia de aprovação — exactamente a
     afirmação que o resto deste módulo foi corrigido para não fazer.
  */
  ressalva: 'Isto mede o que está registado no Akuris. A suficiência de cada prova é juízo do auditor.',
};

const EN: typeof PT = {
  titulo: 'Audit readiness',

  aindaNao: '{feitos} of {total} applicable requirements are compliant. Close what is listed below before scheduling.',

  pronto_certificado: 'Every applicable requirement is compliant. You can engage an accredited certification body and schedule the certification audit.',
  pronto_relatorio: 'Every applicable requirement is compliant. You can engage the independent auditor who issues the report.',
  pronto_lei: 'Every applicable requirement is compliant. You can demonstrate compliance to the authority and to your customers — there is no certificate for this legislation.',
  pronto_referencial: 'Every applicable requirement is compliant. This framework has no formal external audit: what exists is the assessment you have just completed.',

  bloqueio: {
    nao_avaliado: {
      one: '1 requirement has not been assessed yet — without it, you do not know where you stand',
      other: '{count} requirements have not been assessed yet — without them, you do not know where you stand',
    },
    nao_conforme: {
      one: '1 non-compliant requirement',
      other: '{count} non-compliant requirements',
    },
    parcial: {
      one: '1 partially compliant requirement',
      other: '{count} partially compliant requirements',
    },
    conforme_sem_prova: {
      one: '1 compliant requirement with no evidence attached',
      other: '{count} compliant requirements with no evidence attached',
    },
  },

  ressalva: 'This measures what is recorded in Akuris. Whether each piece of evidence is sufficient is the auditor’s judgement.',
};

export const gapProntidao = {
  pt: { gapProntidao: PT },
  en: { gapProntidao: EN },
};
