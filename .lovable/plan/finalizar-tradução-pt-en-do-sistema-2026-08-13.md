# Finalizar tradução (PT/EN) do sistema

Sim, ainda falta. O levantamento mostra que os módulos principais (Dashboard, Riscos base, Gap Analysis, Documentos/DocGen, Due Diligence, Projetos, Auditorias) já usam o dicionário, mas **cerca de 40 telas/diálogos ainda têm texto fixo em português** e não consomem `useLanguage`.

## O que ainda está em português

Páginas sem nenhuma tradução:
- Landing/Blog públicos: `LandingPage`, `Blog`, `BlogPost`, `FrameworkSEO`, `PoliticaPrivacidade`
- Portal externo: `Assessment` (questionário do fornecedor), `ReviewExterna`
- Canal de denúncias público: `DenunciaFormulario`, `DenunciaConsulta`, `DenunciaMenu`, `DenunciaPublicLanding`, `DenunciaExternaRedirect`
- `PlanosAssinatura`, partes de `Configuracoes`

Componentes com maior volume de texto fixo (agrupado):
- Configurações e integrações (~305 strings): usuários, empresas, planos, API keys, webhooks, Azure, lembretes, financeiro IA
- Riscos — formulários e drawers (~232): `RiscoFormWizard`, `RiscoDetailDrawer`, `MatrizForm`, `TratamentoForm`, `RiscoPerfilCompleto`
- Denúncias (~99), Revisão de Acessos (~95), Contas Privilegiadas (~66)
- Gap Analysis — diálogos restantes (~119): `RequirementDetailDialog`, `GenericRequirementsTable`, v2
- Continuidade (~26), Dados/LGPD (~22), Landing components (~21)

## Plano de execução (4 ondas)

**Onda 1 — Telas externas/públicas** (maior impacto para usuário internacional)
Assessment do fornecedor, Revisão externa, canal de denúncias público e páginas de marketing/blog. Novos dicionários `public-portal.ts` e `landing.ts`.

**Onda 2 — Riscos (formulários e detalhe)**
Wizard de risco, matriz, tratamentos, drawer e perfil completo, reaproveitando `riscos-dialogs.ts`/`riscos-detalhe.ts` existentes.

**Onda 3 — Configurações e administração**
Usuários, empresas, planos, API keys, webhooks, integrações Azure/entrada, lembretes, financeiro IA. Novo dicionário `configuracoes.ts`.

**Onda 4 — Módulos restantes**
Denúncias (admin), Revisão de Acessos, Contas Privilegiadas, Continuidade, Dados/LGPD e diálogos remanescentes do Gap Analysis.

## Detalhes técnicos

- Cada onda cria/estende arquivos em `src/i18n/modules/` (pt + en) e registra em `src/i18n/modules/index.ts`.
- Componentes passam a usar `useLanguage()`; textos com listas usam `tList`.
- Datas/status continuam via `date-utils.ts` e `formatStatus` (já sensíveis ao idioma).
- Ao final de cada onda: script de validação de chaves (uso no código x dicionário) + `tsgo` para garantir zero chaves órfãs e build limpo.
- Sem mudanças de lógica de negócio, banco ou Edge Functions.

Posso executar as ondas em sequência ou apenas a Onda 1 primeiro, se preferir validar o resultado antes.
