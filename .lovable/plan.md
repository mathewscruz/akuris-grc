# Revisão módulo a módulo — visual e interação

Objetivo: cada módulo se comportar igual (abrir registro, estados vazios, status, links) e falar o idioma do usuário.

## Remover
- Status com selo genérico em Privacidade (retenção), Continuidade (estado do plano) e Relatórios (publicado/rascunho/arquivado) → todos passam para o selo de status padrão com cores semânticas.

## Alterar
- **Controles, Auditorias (itens) e Denúncias:** a ficha de leitura hoje abre como janela central; passa para o painel lateral padrão (mesmo de Ativos, Riscos, Contratos), com indicadores, ligações, atividade e anterior/próximo. Edição continua nos formulários atuais. Em Denúncias, conteúdo sigiloso segue as mesmas regras de acesso.
- **Revisão de Acessos:** revisões do histórico passam a abrir ao clicar (somente leitura).
- **Continuidade:** nome do sistema vinculado vira link para a ficha do sistema.
- **Textos fixos em português** (Riscos: Rascunho/Em revisão/Arquivar risco; Continuidade: estados) → traduzidos pt-BR/pt-PT/en.

## Criar
- **Estados vazios com próxima ação** onde hoje só há texto:
  - Gap Analysis (frameworks): "Ativar framework".
  - Incidentes: "Registrar incidente".
  - Denúncias: "Copiar link do canal" (primeiro uso) / "Limpar busca".
  - Revisão de Acessos (histórico): "Ver revisões ativas".
  - Controles e Documentos com filtro: "Limpar filtros".
- Regra: com filtro ativo → "Limpar filtros"; sem dados → ação de criar (respeitando permissão).

## Mantido como está (já padronizado)
Ativos, Fornecedores, Planos de Ação, Contratos, Projetos, Configurações. Painel inicial fica fora (pedido anterior).

## Verificação
- Abrir cada módulo alterado logado (desktop e celular), clicar em linha, testar estado vazio e filtros; conferir em inglês.

## Detalhes técnicos
- Fichas → `RecordDetailDrawer` + hooks de `useDetalheLigacoes`: `controles/ControleDetalheDialog.tsx`, `auditorias/ItemAuditoriaDetalheDialog.tsx`, `denuncia/DenunciaDialog.tsx` (manter dialog para edição).
- `RevisaoAcessos.tsx:440` adicionar `onRowClick`; `Continuidade.tsx:159` link com `stopPropagation`.
- Status: `StatusBadge` + resolvers novos em `status-tone.tsx` (retenção, plano de continuidade, relatório).
- Empty states: `EmptyState action` em `GapAnalysisFrameworks.tsx:719`, `Incidentes.tsx:589`, `DenunciasDashboard.tsx:515`, `RevisaoAcessos.tsx:455`, `ControlesContent.tsx:749`, `Documentos.tsx:650`.
- i18n: `Riscos.tsx:790,796,968,1080`, `Continuidade.tsx:30-35`.
