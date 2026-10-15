# Painéis laterais de detalhe mais completos

## O que existe hoje
- **Ativos** (ficha nova) e **Riscos** usam painéis próprios, com abas, contexto e ligações. São o modelo a seguir.
- **Contratos, Incidentes, Privacidade, Contas Privilegiadas, Licenças, Chaves, Fornecedores e Sistemas** usam um painel genérico. Ele mostra uma única lista de campos e "criado por / em", sem abas, sem ligações, sem histórico e sem próximas ações.

## Direção visual (igual para todos os módulos)
O painel genérico vira uma **ficha em duas zonas**, com a identidade do Akuris:

```text
+-----------------------------------------------------------+
| Ícone  EYEBROW · Código                     < >  Editar ...|
|        Título do registo                                   |
|        [Situação] [Severidade] [Responsável]               |
|-----------------------------------------------------------|
| Indicadores-chave: 3 a 4 números (ex.: valor, dias p/ fim) |
| Alerta contextual (vencido, prazo legal, SLA estourado)    |
|-----------------------------------------------------------|
| Abas: Visão geral | Ligações | Atividade | Anexos          |
+-----------------------------------------------------------+
```

- **Cabeçalho:** código lógico, setas para o registo anterior e o próximo da lista, botão Editar e menu de ações.
- **Faixa de indicadores:** os números que importam para cada módulo.
- **Alerta contextual:** só aparece quando há algo a fazer.
- **Visão geral:** campos agrupados em secções com título (ex.: Identificação, Financeiro, Prazos), em vez de uma lista solta.
- **Ligações:** riscos, controles, ativos, planos de ação e fornecedores ligados. Cada um é clicável.
- **Atividade:** linha do tempo com criação, mudanças de estado e comentários.
- **Anexos:** quando o módulo tem anexos.

## Conteúdo por módulo
| Módulo | Indicadores | Alerta | Ligações |
|---|---|---|---|
| Contratos | Valor, dias até o fim, aditivos, marcos pendentes | Vence em menos de 60 dias | Fornecedor, aditivos, marcos/faturas, riscos |
| Incidentes | Severidade, tempo aberto, ativos afetados | Prazo para avisar a ANPD (ou CNPD, conforme a jurisdição) | Ativos, riscos, comunicações, planos |
| Privacidade (ROPA/titulares) | Bases legais, dados sensíveis, prazo do titular | Pedido do titular perto do prazo legal | Sistemas, fornecedores, riscos |
| Fornecedores | Nota de due diligence, contratos ativos, risco | Avaliação vencida ou risco alto | Contratos, due diligence (com nota por tema), riscos |
| Contas Privilegiadas / Sistemas | Contas, última revisão, MFA | Revisão de acesso atrasada | Contas, ativos, riscos |
| Licenças / Chaves | Dias para vencer, custo, uso | Vencida ou a vencer | Ativos, contrato |

## Ordem de entrega
1. Novo painel genérico (cabeçalho, indicadores, alerta, abas, anterior/próximo), compatível com o que já existe.
2. Contratos, Incidentes e Fornecedores (os mais vistos em demonstração).
3. Privacidade, Contas Privilegiadas/Sistemas, Licenças e Chaves.
4. Conferir com os dados da Nexure em claro e escuro, no computador e no celular.

## Detalhes técnicos
- Evoluir `src/components/common/RecordDetailDrawer.tsx` com props opcionais: `code`, `kpis[]`, `alert`, `sections[]` (campos agrupados), `tabs[]`, `onPrev/onNext`. Assim, quem usa o formato antigo continua a funcionar.
- Novo `src/components/common/detalhe/` com `DetailKpiStrip`, `DetailAlert`, `DetailLinks` (usa `routeForEntity` + `fetchEntitiesByIds`, sempre filtrado por `empresa_id`) e `DetailTimeline` (trilha de auditoria + comentários existentes).
- Hooks por módulo que carregam ligações e contagens com query keys por empresa; nenhum dado de outra empresa.
- Visual: Chip/StatusBadge, AkurisPulse para carregamento, ícones proprietários, chart-tokens; roxo só em ações.
- Todos os textos novos em PT e EN via `t()`, com teste de paridade i18n.
- Teste de regra: alerta de vencimento de contrato (< 60 dias) e prazo de titular, com valores concretos.

## Fora deste plano (confirmar depois)
Controles, Documentos, Auditorias, Continuidade e Planos de Ação têm vistas próprias e não foram revistos aqui. Posso incluí-los numa segunda fase.
