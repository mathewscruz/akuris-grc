/** Agente de inventário (MeshCentral com a marca Akuris). */
export const agenteInventario = {
  pt: { agenteInventario: {
    menu: 'Agente de inventário', titulo: 'Agente de inventário Akuris',
    descricao: 'Instale o Akuris Agent nas máquinas da empresa. Elas aparecem em Ativos com hardware, sistema e programas, e são atualizadas de hora em hora.',
    ativar: 'Ativar agente para a empresa', ativando: 'Ativando…', apenasAdmin: 'Só administradores podem ativar o agente.',
    naoConfigurado: 'O servidor de inventário do Akuris ainda não está configurado.', indisponivel: 'Servidor de inventário indisponível. Tente novamente.',
    windows: 'Baixar para Windows', macos: 'Baixar para macOS', linux: 'Linux (terminal)', copiar: 'Copiar comando', copiado: 'Comando copiado',
    silencioso: 'Para instalar em massa (Intune/GPO), use o instalador do Windows com o parâmetro -fullinstall.',
    sincronizar: 'Sincronizar agora', sincronizado: '{n} máquinas sincronizadas', ultima: 'Última sincronização: {data}', nunca: 'Ainda não sincronizado',
    somenteInventario: 'O agente só coleta inventário; acesso remoto fica desligado.',
  } },
  en: { agenteInventario: {
    menu: 'Inventory agent', titulo: 'Akuris inventory agent',
    descricao: 'Install the Akuris Agent on company machines. They appear in Assets with hardware, OS and software, refreshed every hour.',
    ativar: 'Enable agent for the company', ativando: 'Enabling…', apenasAdmin: 'Only administrators can enable the agent.',
    naoConfigurado: 'The Akuris inventory server is not configured yet.', indisponivel: 'Inventory server unavailable. Try again.',
    windows: 'Download for Windows', macos: 'Download for macOS', linux: 'Linux (terminal)', copiar: 'Copy command', copiado: 'Command copied',
    silencioso: 'For mass deployment (Intune/GPO), use the Windows installer with the -fullinstall parameter.',
    sincronizar: 'Sync now', sincronizado: '{n} machines synced', ultima: 'Last sync: {data}', nunca: 'Not synced yet',
    somenteInventario: 'The agent only collects inventory; remote access is disabled.',
  } },
};
