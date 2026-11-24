- [x] Fix selected spreadsheet and campaign injection findings.
- [x] Restrict selected Google directory actions, requirement diagnostics, framework assignment and new audit risk acceptance; existing decisions unchanged.
- [x] Deploy four functions; confirm unsigned calls return 401 and database guards are installed. Regression tests and browser sanitization verified; signed-in external-service flows unavailable here.
- [ ] Confirm approved destinations before restricting scan and webhook targets (four selected findings).
## Agente de inventário (MeshCentral)
- [ ] Servidor MeshCentral no ar + segredos MESH_URL/MESH_USER/MESH_PASSWORD (aguarda usuário)
- [ ] Agendar sincronização de hora em hora (após o servidor existir)
- [ ] Teste real: instalar numa máquina e ver o ativo aparecer

## Microsoft 365 unificado
- [ ] Registrar o aplicativo multi-tenant no Entra ID da Akuris e salvar MICROSOFT_INTEGRATION_CLIENT_ID / _SECRET (aguarda usuário)
- [ ] Testar com um tenant real: consentimento e dispositivos do Intune entrando em Ativos (depende do item acima)
