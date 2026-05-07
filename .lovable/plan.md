## Atualização dos Planos Comerciais Akuris

Alinhar a tabela `planos` à grade comercial atual (Start / Manager / Full).

### Schema (migration)
Adicionar 3 colunas em `planos`:
- `preco_setup numeric DEFAULT 0` — taxa única de implantação
- `setup_observacao text` — texto livre (ex.: "A partir de R$ 6.000,00")
- `publico_alvo text` — faixa de empresa recomendada

### Dados
Atualizar os 3 planos existentes (mantendo `codigo` para preservar mapeamentos de ícones em `PlanBadge.tsx` e `AssinaturaTab.tsx`):

| codigo (mantido) | nome | público-alvo | mensal | setup | franquia IA |
|---|---|---|---|---|---|
| `compliance_start` | **Akuris Start** | Pequenas Empresas (50–100) | R$ 590,00 | R$ 1.500,00 | 20 créditos |
| `grc_manager` | **Akuris Manager** | Médias Empresas (101–499) | R$ 1.290,00 | R$ 3.500,00 | 75 créditos |
| `governaii_enterprise` | **Akuris Full** | Empresas Maduras / Alta Demanda (500+) | R$ 2.990,00 | A partir de R$ 6.000,00 | 200 créditos |

`is_destaque = true` para o Manager (plano recomendado).

### Frontend
- `PlanoFormDialog.tsx`: adicionar 3 campos de input (preço setup, observação setup, público-alvo).
- `AssinaturaTab.tsx`: exibir o `publico_alvo` e a taxa de setup nos cards de plano.
- `PlanBadge.tsx`: nada a alterar (códigos preservados).

### Sem impacto
- Códigos internos preservados → mapeamentos de ícone, lógica de billing e RLS continuam funcionando.
- Empresas já vinculadas mantêm `plano_id`; apenas exibem nome/valor novos.
- Nenhuma edge function depende dos nomes antigos (verificado).

Aprovar para executar.