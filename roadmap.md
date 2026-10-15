# Correções em Incidentes
- [x] Formatar impacto com rótulos PT/EN.
- [x] Mostrar nomes dos ativos vinculados com links e estados de carregamento/erro/indisponibilidade.
- [x] Validar testes, isolamento por empresa e erros da aplicação (8 testes passaram; build OK).
- [ ] Conferir o fluxo autenticado nas telas — bloqueado: Supabase externo sem acesso de teste disponível.
# Akuris mais autônomo
- [x] Orientações dos requisitos preparadas em segundo plano (a cada 15 min, PT depois EN).
- [ ] Resumo semanal no sino e por e-mail.
- [ ] Planos de ação e riscos sugeridos a partir de lacunas/achados.
- [ ] Leitura automática de documentos enviados e caixa de entrada por e-mail.
- [ ] Integrações reais Microsoft/AWS — precisa das credenciais do cliente.

# Diferenciais (plano aprovado 15/10)
- [x] B1: framework BACEN 4.893 no catálogo (24 requisitos PT/EN).
- [x] B2: ANPD 15/2024, SUSEP 638 e CVM 35 no catálogo (revisão jurídica recomendada).
- [ ] B3: ANS — aguarda indicação da norma exata pelo usuário.
- [ ] A: configuração automática pelo CNPJ.
- [ ] C: relógio regulatório (ANPD 3 dias úteis, CNPD 72h, titulares 15 dias).
- [ ] D, E, F, G, H, I — planos próprios.
# Menos interações — itens 3, 4 e 5 (aprovado 15/10)
- [x] 3a: seleção múltipla na tabela padrão + barra de ações em lote em Riscos, Controles, Planos de Ação, Incidentes e Contratos (mudar situação com escopo de empresa + exportar selecionados).
- [x] 3b: reuso entre frameworks — já existia no Gap Analysis (HerancaCrossFramework, aprovação em um clique); verificado.
- [x] 3c: e-mail de plano vencido com link de uso único (concluir / adiar 7 dias).
- [x] 4: preenchimento inteligente — responsável padrão e prazo por prioridade no plano de ação; categoria sugerida pelo título no risco (src/lib/preenchimento-inteligente.ts, 9 testes).
- [x] 5a: pacote de auditoria em PDF com um clique na página do framework (requisitos + evidências + planos em aberto).
- [x] 5b: Trust Center público por empresa (Configurações → Trust Center, página /trust/:endereço).
- [x] 5c: resposta automática a questionários (Configurações → Trust Center, 1 crédito IA, CSV).
