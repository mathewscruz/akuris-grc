/** Riscos sugeridos pelas integrações (Google Workspace / Microsoft). */
const regrasPt = {
  admin_sem_mfa: { titulo: "Administradores sem verificação em duas etapas", descricao: "Contas com privilégios de administrador não têm segundo fator registrado. Um roubo de senha dá controle total do ambiente." },
  usuarios_sem_mfa: { titulo: "Usuários sem verificação em duas etapas", descricao: "Contas ativas sem segundo fator ficam expostas a phishing e reutilização de senha." },
  excesso_admins: { titulo: "Excesso de administradores", descricao: "Há mais administradores do que o recomendado (até 4), aumentando a superfície de ataque e o risco de erro." },
  contas_inativas: { titulo: "Contas ativas sem uso há mais de 90 dias", descricao: "Contas sem login recente continuam habilitadas e podem ser usadas sem que ninguém perceba." },
  falhas_login: { titulo: "Tentativas de login com falha recorrentes", descricao: "Usuários com 10 ou mais falhas de login no período analisado, possível ataque de senha." },
  dispositivos_nao_conformes: { titulo: "Dispositivos fora de conformidade", descricao: "Dispositivos gerenciados que não cumprem as políticas de conformidade da organização." },
  dispositivos_sem_criptografia: { titulo: "Dispositivos sem criptografia de disco", descricao: "A perda ou roubo destes dispositivos expõe os dados armazenados." },
  dispositivos_sem_sincronizar: { titulo: "Dispositivos sem sincronizar há mais de 30 dias", descricao: "Dispositivos que não reportam podem estar sem atualizações ou fora de controle." },
};
const regrasEn = {
  admin_sem_mfa: { titulo: "Administrators without two-step verification", descricao: "Accounts with administrator privileges have no second factor registered. A stolen password gives full control of the environment." },
  usuarios_sem_mfa: { titulo: "Users without two-step verification", descricao: "Active accounts without a second factor are exposed to phishing and password reuse." },
  excesso_admins: { titulo: "Too many administrators", descricao: "There are more administrators than recommended (up to 4), increasing attack surface and error risk." },
  contas_inativas: { titulo: "Active accounts unused for over 90 days", descricao: "Accounts with no recent sign-in remain enabled and could be misused unnoticed." },
  falhas_login: { titulo: "Recurring failed sign-in attempts", descricao: "Users with 10 or more failed sign-ins in the analysed window, a possible password attack." },
  dispositivos_nao_conformes: { titulo: "Non-compliant devices", descricao: "Managed devices that do not meet the organisation's compliance policies." },
  dispositivos_sem_criptografia: { titulo: "Devices without disk encryption", descricao: "Loss or theft of these devices exposes stored data." },
  dispositivos_sem_sincronizar: { titulo: "Devices not synced for over 30 days", descricao: "Devices that stop reporting may be unpatched or out of control." },
};
export const riscosSugeridos = {
  pt: {
    riscosSugeridos: {
      tab: "Sugeridos pelas integrações",
      intro: "Falhas de configuração encontradas automaticamente nas integrações conectadas. Aceite para levar ao registro de riscos ou descarte com um motivo.",
      colRisco: "Risco", colOrigem: "Origem", colAfetados: "Afetados", colNivel: "Nível sugerido", colEstado: "Estado", colDetectado: "Última detecção",
      estados: { aberta: "Aguardando decisão", aceita: "Aceito", descartada: "Descartado", corrigida: "Corrigido na origem" },
      corrigidoEm: "Corrigido na origem em {data}",
      afetados: "Itens afetados ({n})", maisItens: "e mais {n}",
      probImpacto: "Probabilidade {p} · Impacto {i}",
      aceitar: "Aceitar como risco", descartar: "Descartar", motivo: "Motivo do descarte", motivoPh: "Ex.: exceção aprovada pela diretoria",
      aceito: "Risco criado no registro", descartado: "Sugestão descartada", erro: "Não foi possível concluir a ação",
      verRisco: "Abrir risco", vazio: "Nenhuma falha encontrada", vazioDesc: "Conecte o Google Workspace ou a Microsoft em Configurações › Integrações; a análise roda a cada coleta.",
      regras: regrasPt,
    },
  },
  en: {
    riscosSugeridos: {
      tab: "Suggested by integrations",
      intro: "Configuration gaps found automatically in connected integrations. Accept to add to the risk register or dismiss with a reason.",
      colRisco: "Risk", colOrigem: "Source", colAfetados: "Affected", colNivel: "Suggested level", colEstado: "State", colDetectado: "Last detected",
      estados: { aberta: "Awaiting decision", aceita: "Accepted", descartada: "Dismissed", corrigida: "Fixed at source" },
      corrigidoEm: "Fixed at source on {data}",
      afetados: "Affected items ({n})", maisItens: "and {n} more",
      probImpacto: "Likelihood {p} · Impact {i}",
      aceitar: "Accept as risk", descartar: "Dismiss", motivo: "Dismissal reason", motivoPh: "E.g. exception approved by management",
      aceito: "Risk created in the register", descartado: "Suggestion dismissed", erro: "Could not complete the action",
      verRisco: "Open risk", vazio: "No gaps found", vazioDesc: "Connect Google Workspace or Microsoft in Settings › Integrations; the analysis runs on every collection.",
      regras: regrasEn,
    },
  },
};
