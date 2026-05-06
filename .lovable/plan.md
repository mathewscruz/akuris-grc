## Plano de correção — QA Walkthrough 2026-05-06 (CONCLUÍDO)

### Onda 1 ✅ — Quick wins
- Rota pública `/denuncia` (DenunciaRouter + DenunciaPublicLanding).
- Skeletons → AkurisPulse em data-table, Dashboard, Riscos, Due Diligence etc.
- Spinners CSS substituídos por AkurisPulse pequeno.

### Onda 2 ✅ — Status Badges
- Resolvers adicionados: `resolveGravidadeTone`, `resolveCategoriaTone`, `resolveQuestionTypeTone`.
- Migrados: DenunciaConsulta, DenunciaDialog, AssessmentsManager, TemplatesManager, QuestionsManager, ReportsView.

### Onda 3 ✅ — Toasts unificados
- `use-toast` já é shim Sonner (mapeia variant→toast.error/success/warning/info).
- Toaster Radix legado já não está no tree.

### Onda 4 ✅ — i18n + logging hygiene
- `register.trialBadge` adicionado (PT/EN); Registro consome `t()`.
- console.* → logger.error|warn em: DefinirSenha, NotFound, NotificationCenter, ItemAuditoriaFormDialog, UploadMultiplosDialog, VinculacoesDialog.

### Onda 5 ✅ — UX polish
- ErrorBoundary: "Tentar Novamente" agora primário; "Recarregar Página" secundário (outline).
- NotFound: usa `<Button asChild><Link>`, sem full reload; logger.warn com path.
- Auth: título "Bem-vindo de volta" elevado de h2 → h1.
