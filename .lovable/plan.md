# Plano: Validação completa do fluxo do usuário (QA UX)

## Objetivo
Executar um walkthrough automatizado da ferramenta inteira usando o browser para identificar inconsistências visuais, navegação quebrada, telas brancas, erros de console e problemas de fluidez. Entregar um **relatório consolidado** com achados priorizados — sem aplicar correções nesta etapa (correções em loop separado, após sua aprovação dos achados).

## Escopo da varredura

### 1. Autenticação e onboarding
- `/auth` — login, validação de campos, fluxo MFA (sem disparar código real), "esqueci minha senha"
- `/registro` e `/definir-senha` — renderização e validações
- Logout e re-login

### 2. Dashboard e navegação principal
- `/dashboard` — Hero Score, KPI Pills, drill-down drawer, GRC maturity bars, AkurIA chatbot
- Sidebar agrupada — todos os 8 módulos GRC clicáveis, sub-itens (fade stagger), prefetch
- Header — breadcrumbs, command palette (Cmd+K), changelog, theme toggle, notification center, user profile
- Mobile bottom nav (375px viewport)

### 3. Módulos GRC (entrada + 1 ação chave em cada)
Riscos, Controles, Gap Analysis, Auditorias, Incidentes, Privacidade/LGPD, Continuidade, Due Diligence, Contratos, Ativos, Documentos, Denúncia, Revisão de Acessos, Planos de Ação, Relatórios, Contas Privilegiadas, Sistemas, Governança.

Em cada módulo: abrir lista, abrir um dialog (novo/editar), fechar, validar empty state e loader (`AkurisPulse` único).

### 4. Configurações e administração
- `/configuracoes` — abas, gerenciamento de usuários, permissões, changelog admin
- Trial banner / créditos de IA esgotados (banners globais)

### 5. Responsividade
- Desktop 1440, tablet 820, mobile 390 — checar dialogs fullscreen mobile, tabelas com scroll horizontal, sidebar colapsada.

### 6. Tema e idioma
- Toggle dark/light em rotas-chave
- Toggle PT/EN — confirmar que strings traduzem (sem chaves cruas tipo `layout.blockedTitle`)

## Critérios de inconsistência a registrar
- Tela branca / Suspense que não resolve / loader infinito
- Erros no console (`code--read_console_logs` + `browser--read_console_logs`) e requisições 4xx/5xx (`browser--list_network_requests`)
- React warnings (Fragment props, key duplicada, hydration)
- Uso de `Loader2`/spinner CSS/Skeleton visível (proibido por memória — só `AkurisPulse`)
- Badges com `bg-{red,blue,...}-100` cru (proibido — usar `StatusBadge`)
- Ícones fora do padrão Akuris (stroke != 1.5, ícones lucide onde existe ícone proprietário)
- Quebra de layout: overflow horizontal indesejado, dialog cortado, texto clipado
- Navegação: link 404, breadcrumb errado, redirect loop, botão "Voltar" inexistente
- Toasts: uso de Radix Toast em vez de Sonner / `akurisToast`
- Falta de `empresa_id` causando lista vazia indevida
- Acessibilidade básica: foco visível, contraste, aria-labels em botões só-ícone

## Método de execução
1. `browser--navigate_to_sandbox` para `/auth` → login com a sessão preview já autenticada (sem mexer em credenciais; se cair em login, paro e peço).
2. Para cada rota: `navigate` → aguardar render → `screenshot` + `read_console_logs` + `list_network_requests` filtrados por erro.
3. Para dialogs: `observe` → `act` (abrir) → `screenshot` → fechar.
4. Repetir nos 3 viewports.
5. Verificar grep no código de padrões proibidos (`Loader2`, `animate-spin`, `bg-red-100` em badges, `useToast` Radix) para complementar achados visuais.

## Entregável
Relatório markdown em `/mnt/documents/qa-walkthrough-2026-05-06.md` agrupado por:
- Severidade (Crítico / Alto / Médio / Baixo / Polish)
- Módulo / rota
- Evidência (screenshot path, log, snippet)
- Sugestão de correção

Resumo executivo no chat com top 10 achados e contagem por severidade.

## Fora do escopo
- Aplicar correções (faremos em loop separado após você priorizar)
- Testes destrutivos (delete em massa, alterar dados de outras empresas)
- Pen-test / segurança avançada (tem o scanner dedicado)

## Observações técnicas
- Browser pode falhar ao iniciar (capacidade) — nesse caso sigo só com leitura de código + console logs do preview e entrego relatório parcial avisando.
- Se cair na tela de login MFA, paro e aviso (não preencho OTP).
- Tempo estimado: ~15-20 chamadas de browser + leitura de ~10 arquivos.
