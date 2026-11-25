# Riscos sugeridos pelas integrações — plano consolidado

## O que vale para todos os achados
- Tudo entra como **sugestão para análise**. Nada cria risco sozinho: o usuário aceita (cria o risco no registro) ou descarta com motivo.
- Cada sugestão tem **chave estável da origem** (ex.: o ID do incidente), **fonte**, **severidade técnica** separada da probabilidade/impacto sugeridos, **evidência**, **data** e **alcance da coleta**.
- **Agrupamento por causa**, nunca por alerta/CVE/dispositivo; sem corte que esconda achados críticos.
- **Supressão com prazo**: descartar pode definir "até quando"; vencido o prazo e o problema ainda presente, a sugestão reabre e a recorrência é contada.
- **Aceitação idempotente**: aceitar duas vezes devolve o mesmo risco, sem duplicar.
- **Cobertura honesta**: uma sugestão só vira "corrigida na origem" quando a regra foi avaliada com dados completos. 403, falta de licença, timeout, paginação parcial, escopo alterado ou desconexão **nunca** marcam corrigido.
- **Desconectar não apaga** o histórico nem o risco já aceito.
- **Notificação agregada** por coleta no sino, nunca por item.

## Microsoft — o que é lido hoje
| Fonte | O que produz | Permissão necessária |
|---|---|---|
| `/security/incidents` (Defender XDR) | Incidentes **high** ainda **ativos**, agrupados por tema (ransomware, malware, phishing, conta comprometida, movimento lateral, vazamento, configuração, dispositivo, outros). Falsos positivos, benignos e resolvidos ficam fora da triagem; ativo sem classificação definida conta. | `SecurityIncident.Read.All` (Application) |
| `/identityProtection/riskyUsers` | Contas em risco alto e ainda em risco. | `IdentityRiskEvent.Read.All` / `Policy.Read.All` (já no app) |
| `/security/secureScores` + `/security/secureScoreControlProfiles` | Até 5 lacunas de controle de maior impacto (maxScore ≥ 5, não deprecados). Nunca um risco pelo score global. | `SecurityEvents.Read.All` (Application) |
| Defender for Endpoint `/api/recommendations` | Recomendações **Active** com exploração pública, dispositivos críticos expostos ou severidade alta, ordenadas por exposição. | `SecurityRecommendation.Read.All` (API própria do Defender, token com audiência `api.securitycenter.microsoft.com`) |

Sinais e cobertura dependem das licenças do cliente; nada é prometido automaticamente.

## Google — o que é lido hoje
Somente campos explícitos já coletados: admin, 2SV cadastrada (`isEnrolledIn2Sv`) e 2SV obrigatória (`isEnforcedIn2Sv`), último login (`lastLoginTime`).
- **Nada de Alert Center**: `apps.alerts` concede leitura **e escrita** e exige conta de serviço com delegação — não autorizado. Documentado como opcional, exige consentimento específico.
- Regras de Drive público/externo e bloqueio/criptografia de dispositivos **não ativadas**: sem campo mapeado, a regra não roda e não marca corrigida.
- Falhas de login não são tratadas como ataque; inatividade só com `lastLoginTime` explícito.

## Permissões novas por API (resumo)
- Microsoft Graph: `SecurityIncident.Read.All`, `SecurityEvents.Read.All` — precisam de registro no app + consentimento de administrador.
- Defender for Endpoint: `SecurityRecommendation.Read.All`.
- Google: nenhuma nova.

## Estado
Implementado no backend e no frontend, com testes e typecheck passando. Backend ainda precisa ser publicado para valer em produção.
