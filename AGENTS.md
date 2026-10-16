# Architecture rules
- Incident asset references are resolved through the central entity registry with tenant-scoped query keys; this preserves stored UUID links and reuses canonical navigation without exposing raw identifiers.
- Integration catalog statuses and the connected section share the same tenant-scoped query through useConexoesAtivas; this prevents contradictory connection labels without enabling new connections.- Module side panels use the shared RecordDetailDrawer (KPIs, contextual alert, grouped sections, Links/Activity tabs, prev/next); link data comes from tenant-scoped hooks in useDetalheLigacoes, so every module keeps one visual pattern.
- Long-running AI analyses (document adherence) run as tenant-scoped job rows processed in short self-invoking slices with a DB lock; this avoids edge timeouts for any document size.
- List/grid views reuse the same DataTable columns, sorting, pagination and row actions; this prevents divergent results across representations.
- Module tab bars use ModuleSubbar with the existing list search state; this keeps local filtering distinct from global search.
- OwnerCell and RecordProgress are shared record-cell presentations; progress accepts measured values only, never inferred workflow percentages.
