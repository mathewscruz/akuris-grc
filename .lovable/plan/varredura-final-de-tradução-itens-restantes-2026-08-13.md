# Varredura final de tradução — itens restantes

Os dois exemplos enviados ("VENCIMENTOS" e o selo "Vencido" em Contratos) são textos fixos em português no código: `src/pages/Contratos.tsx` linha 370 (`title="Vencimentos"`) e linha 255 (`<StatusBadge ...>Vencido</StatusBadge>`). A varredura anterior não os detectou porque o script só procurava palavras com acento ou conectivos ("de", "não", "para") — palavras sem acento como "Vencido", "Contratos", "Prazo" passavam batido.

Uma nova varredura, agora com dicionário de termos do domínio, encontrou o que sobrou.

## O que ainda falta traduzir

| Grupo | Volume | Exemplos |
|---|---|---|
| Títulos de cards, KPIs, colunas e abas | ~45 strings em 30 arquivos | Contratos ("Vencimentos", "Vencimento", "Fornecedores", "Exportar CSV"), Ativos ("Alto Valor", "Criticidade Alta"), Continuidade ("Planos Ativos", "Tarefas Pendentes"), Privacidade ("Tipos catalogados", "Dados x Ativos"), Riscos ("Controles", "Resumo", "Prazo", "Risco anterior") |
| Selos de status escritos direto no JSX | poucos, mas visíveis | "Vencido" em Contratos (deve usar o dicionário de status já localizado) |
| Mensagens de toast e erro | ~49 mensagens em 16 arquivos | "Tratamento criado com sucesso!", "Erro ao vincular evidência.", "Sessão encerrada por inatividade", "PDF exportado com sucesso" |
| Textos de carregamento e acessibilidade | 4 | `AkurisPulse`, `LoadingOverlay`, `BlogPost`, `PlanosAssinatura` ("Voltar") |
| Páginas públicas restantes | 2 | `FrameworkSEO` ("Por que importa"), `OnboardingWizard` ("Configure sua plataforma") |

Fora do escopo (não são texto de interface): e-mails de contato, URLs de exemplo nos diálogos de integração (Slack/Teams/Jira) e nomes técnicos de coluna do importador de ativos (`nome`, `tipo`, `valor_negocio` — são cabeçalhos do CSV que o cliente envia).

## Como será feito

1. **Onda 1 — Contratos, Ativos, Continuidade, Privacidade, Contas Privilegiadas, Chaves.** Trocar títulos de KPI, colunas de tabela, abas e selos por chaves de tradução. O selo "Vencido" passa a usar o dicionário de status existente (que já tem versão em inglês).
2. **Onda 2 — Riscos e Gap Analysis.** Rótulos de seções, drawers e wizard ("Controles", "Resumo", "Detalhes Adicionais", "vs. anterior", "evidências com cruzamentos pendentes").
3. **Onda 3 — Mensagens de sistema.** Todos os toasts de sucesso e erro dos hooks e formulários, mais textos de carregamento, sessão expirada e o botão "Voltar".
4. **Onda 4 — Guardrail.** Ampliar o teste automatizado de i18n com o dicionário de domínio usado nesta varredura, para que qualquer texto novo em português escrito direto no código quebre o build antes de chegar ao usuário.

## Detalhes técnicos

- Chaves novas entram nos módulos existentes (`campos`, `cards-kpi`, `residuos`, `gap-v2`) — nenhum módulo novo, para não fragmentar o dicionário.
- Toasts em hooks (`useProjetos`, `useEvidenceLibrary`, `useProjetoTarefas`, etc.) recebem as mensagens já traduzidas via `useLanguage` no próprio hook; onde o hook não é um componente React, a mensagem é resolvida com o locale global (`getAppLocale`), mesmo padrão já usado em `text-utils.ts`.
- O teste de guarda vira dois arquivos: o de paridade PT/EN já existente e um novo que varre `src/**/*.tsx` procurando literais em português em JSX e props de texto, com lista de exceções explícita (e-mails, URLs, cabeçalhos de CSV).
- Nenhuma alteração de lógica de negócio, banco ou Edge Function.
