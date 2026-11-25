# Riscos relevantes do Microsoft Defender e do equivalente no Google

## Objetivo
Trazer para a aba "Sugeridos pelas integrações" só o que importa no Defender (Microsoft) e na Central de Alertas (Google), sem inundar o módulo de Riscos: poucas sugestões, agrupadas por tema, com evidência.

## O que entra (regra de relevância)
- Somente severidade **Alta** ou **Crítica** (o resto fica de fora).
- **Agrupado por tema**, nunca um risco por alerta: ex. "Malware ativo em dispositivos (3 máquinas)", não 3 riscos.
- Somente o que está **ativo/não resolvido** nos últimos 30 dias.
- Limite de **até 10 sugestões abertas por integração**, as de maior nível primeiro.
- Quando o problema some no provedor, a sugestão vira "Corrigido na origem" (como hoje).

## Microsoft Defender
- **Incidentes e alertas de alta severidade ativos**, agrupados por categoria (malware, ransomware, phishing, conta comprometida, movimento lateral, exfiltração).
- **Vulnerabilidades críticas exploráveis** nos dispositivos (Defender Vulnerability Management), agrupadas: "N dispositivos com falhas críticas com exploit público".
- **Usuários de alto risco** no Entra ID Protection (risco "alto", não remediado).
- **Recomendações de Secure Score de maior impacto não implementadas** (top 5 por pontos).

## Google Workspace (equivalente)
- **Central de Alertas do Google**: alertas ativos de alta gravidade agrupados por tipo (conta suspeita/comprometida, phishing/malware recebido, ataque patrocinado por governo, vazamento por regra de DLP, alteração crítica de configuração).
- Mantemos as verificações atuais (MFA, administradores, contas inativas).
- O Google não oferece por API um painel de configurações de segurança equivalente ao Secure Score; isso fica fora.

## O que muda para o cliente
- **Nova autorização do administrador** nas duas integrações, porque são permissões novas (todas só de leitura). Até reautorizar, nada muda; o cartão mostra "Autorizar novamente" para quem ainda não deu as novas permissões.
- Exige licença com Defender (Microsoft 365 E5/Business Premium/Defender for Endpoint) e, no Google, edição com Central de Alertas. Sem licença, as verificações são ignoradas sem gerar erro nem risco falso.

## Detalhes técnicos
- Microsoft (Graph, permissões de aplicativo, leitura): `SecurityIncident.Read.All`, `SecurityAlert.Read.All` (`/security/incidents`, `/security/alerts_v2`), `IdentityRiskyUser.Read.All` (`/identityProtection/riskyUsers`), `SecurityEvents.Read.All` (`/security/secureScores`, `secureScoreControlProfiles`). Vulnerabilidades: API do Defender for Endpoint (`api.securitycenter.microsoft.com`, permissão `Vulnerability.Read.All` no app multi-tenant Akuris), token app-only separado por audiência. Adicionar ao app registration e ao `microsoftScopes`; novo módulo "defender" em `settings.modules`.
- Google: escopo `https://www.googleapis.com/auth/apps.alerts` (Alert Center API, `alerts.list` com filtro de status e data). Não é ".readonly" no nome, mas usamos só leitura; requer declarar na tela de consentimento e na verificação do Google. Passa a 9 escopos; conexões antigas sem o escopo seguem funcionando e recebem "Autorizar novamente".
- Coleta: novos recursos `kind: "security_alert" | "vulnerability" | "risky_user" | "score_control"` com sinais normalizados (severidade, categoria, status, alvo). 403/licença ausente → aviso por módulo em `settings.module_status`, sem achado e sem marcar como corrigido.
- Regras em `integration-risk-rules.ts`: agrupamento por categoria, filtro de severidade, janela 30 dias, corte em 10 por conexão; `coveredRules` só cobre categorias realmente coletadas. Testes por regra (incluindo corte, agrupamento e licença ausente).
- Textos PT/EN por `regra_id`; sem mudança visual na aba.
- Atualizar a política de privacidade só com aprovação explícita do texto (escopo novo do Google).

## Fora do escopo
- Responder/fechar alertas no Defender ou no Google (continua somente leitura).
- Um risco por alerta individual.
