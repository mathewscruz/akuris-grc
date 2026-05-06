## Plano de correção — QA Walkthrough 2026-05-06

Organizado em 5 ondas, cada uma autoconsumível. Mantém todas as invariantes (AkurisPulse único, StatusBadge, Sonner, logger, multi-tenant).

---

### Onda 1 — Quick wins de alto impacto visual

**1.1 Rota pública `/denuncia` (C1)**
- Em `src/App.tsx`, adicionar rota pública `/denuncia` (sem `:empresa`) que renderiza um novo componente `DenunciaPublicLanding` em `src/pages/DenunciaPublicLanding.tsx`.
- A landing pede o slug/identificador da empresa (input simples) e redireciona para `/:empresa/denuncia`. Mensagem clara: "Informe o código da empresa fornecido pela organização".
- Identidade visual padrão (CornerAccent, AkurisMarkPattern, dark theme).

**1.2 Skeletons → AkurisPulse (A1)** — alavanca em 2 arquivos:
- `src/components/ui/data-table.tsx` (linhas 113-137): substituir bloco Skeleton por `<AkurisPulse />` centralizado com `<p className="text-sm text-muted-foreground">Carregando…</p>`. Elimina ~70% das ocorrências.
- `src/pages/Dashboard.tsx` (linhas 82-90): trocar Skeletons da etapa "profile loading" por `<AkurisPulse size={32} />` em wrapper centralizado.
- Demais arquivos da lista A1 (Riscos, RiscosAceite, MultiDimensionalRadar, RelatorioPreviewDialog, GerenciamentoChangelog, NoticiasTab, Due Diligence): substituições pontuais idênticas.

**1.3 Spinners CSS (A4)**
- `IntegrationLogViewer.tsx:185` e `RequirementDetailDialog.tsx:770`: trocar `animate-spin` em ícone Refresh por `<AkurisPulse size={12} className="mr-2" />`.

---

### Onda 2 — Status Badges (A2)

Criar/estender resolvers em `src/lib/status-tone.tsx`:
- `denunciaStatusTone(status)` → tons existentes (success, warning, danger, neutral, info).
- `gravidadeTone(gravidade)` → mapping (baixa/média/alta/crítica).
- Resolvers para Due Diligence (status de assessment, status de questão).
- Resolver para `gap-analysis/FrameworkCatalog` (categoria).

Substituir em:
- `src/pages/DenunciaConsulta.tsx` (linhas 212-248) — remover `getStatusColor` / `getGravidadeColor`, usar `<StatusBadge tone={denunciaStatusTone(s)}>`.
- `src/components/denuncia/DenunciaDialog.tsx` (254-257).
- `src/components/due-diligence/{TemplatesManager,ReportsView,AssessmentsManager,QuestionsManager}.tsx`.
- `src/components/gap-analysis/FrameworkCatalog.tsx` (23-25).

Critério de aceite: zero ocorrências de `bg-{red,blue,green,yellow,amber,orange}-100` em badges (rg de validação ao final).

---

### Onda 3 — Toasts unificados (A3)

Estratégia minimamente invasiva:
- Transformar `src/hooks/use-toast.ts` em **shim** que delega para `sonner` (mapear `variant: 'destructive'` → `toast.error`, default → `toast.success` ou `toast.info` conforme título). Mantém os 86 callsites funcionando sem mudança imediata.
- Migração explícita (este PR) das 4 páginas principais para `akurisToast({ module, tone, ... })`: `Riscos`, `Incidentes`, `Documentos`, `Contratos`.
- Demais arquivos seguem usando o shim (migração progressiva em backlog).

Validar que `<Toaster />` Radix legado pode ser removido do tree (somente Sonner permanece).

---

### Onda 4 — i18n + logging hygiene

**4.1 i18n /registro (M3)**
- Em `src/i18n/{pt,en}.ts` adicionar:
  - `register.trialBadge` (PT: "14 dias de teste grátis · sem cartão de crédito" / EN: "14-day free trial · no credit card required")
  - `register.taxIdLabelBR` / `register.taxIdLabelIntl`
  - `register.taxIdPlaceholderBR` / `register.taxIdPlaceholderIntl`
- `src/pages/Registro.tsx`: substituir literais; ajustar máscara CNPJ apenas quando idioma = PT (em EN usa input livre com label "Tax ID").

**4.2 i18n /auth (M5)**
- Verificar em `Auth.tsx` que `t('auth.privacyPolicy')`, `t('auth.copyright')` e footer estejam usando `t()`. Adicionar chaves faltantes em ambos idiomas.

**4.3 Logging (M1, M2)**
- Sweep nos arquivos listados: `useScoreHistory`, `useRiscosStats`, `useNotifications`, `NotificationCenter`, `documentos/VinculacoesDialog`, `documentos/UploadMultiplosDialog`, `auditorias/ItemAuditoriaFormDialog`, `pages/NotFound`, `pages/DefinirSenha`.
- Trocar `console.*` por `logger.error|warn|debug` com `module:` adequado.
- Em `NotFound.tsx:10` usar `logger.warn('404', { path: location.pathname, module: 'router' })`.

---

### Onda 5 — UX polish

**5.1 ErrorBoundary (M4)**
- `src/components/ErrorBoundary.tsx`: priorizar visualmente o botão "Tentar Novamente" (handleRetry, primário) e rebaixar "Recarregar página" como secundário/link. Manter `window.location.reload()` apenas no botão secundário.

**5.2 NotFound (P1)**
- Substituir `<a href="/">` por `<Button asChild><Link to="/">Voltar para o início</Link></Button>` (react-router, sem full reload).
- Manter identidade visual (CornerAccent, AkurisPulse opcional).

**5.3 Header /auth (P2)**
- Adicionar `<Tooltip>` em "Voltar ao site" e no LanguageSelector "EN/PT". Aumentar contraste no hover.

**5.4 Acessibilidade /auth (P3)**
- Garantir que o título principal "Bem-vindo de volta" / "Welcome back" seja `<h1>` (já é `h2` hoje em Auth.tsx:335). Manter hierarquia semântica.

---

### Validação final

Antes de fechar cada onda:
1. `rg -n "<Skeleton" src/` → 0 (Onda 1).
2. `rg -n "bg-(red|blue|green|yellow|amber|orange)-100" src/` em badges → 0 (Onda 2).
3. `rg -n "from '@/hooks/use-toast'" src/pages/{Riscos,Incidentes,Documentos,Contratos}.tsx` → 0 (Onda 3).
4. `rg -n "console\.(log|error|warn)" src/{hooks,pages,components}/` → reduzido ao mínimo aceito (Onda 4).
5. Browser walkthrough (sandbox autenticado) confirmando: dashboard sem skeleton flicker, módulo Denúncia com badges Akuris, /registro EN coerente.

---

### Ordem de execução recomendada

Fazer **Onda 1 inteira** primeiro (maior impacto visual e desbloqueia o C1 público). Depois validar comigo antes de seguir para Ondas 2-5, que são mais longas e podem ser entregues em PRs separados.
