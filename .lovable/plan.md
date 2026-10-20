# Financeiro IA: visual arrumado e consumo real por modelo

## O que está errado hoje
- **Visual:** a tabela "Modelos de IA em uso" corta o nome do modelo à esquerda ("emini 4", "PT-5.4 Mini"), aperta o selo do fornecedor contra o preço, e uma nuvem de etiquetas de funcionalidades estica cada linha.
- **Consumo:** os números vêm do registo de créditos cobrados, não das chamadas à IA. Por isso:
  - o modelo é **adivinhado** pela funcionalidade, e o plano B (GPT-5.4 Mini) nunca aparece;
  - chamadas que não cobram crédito (orientação dos requisitos, tradução, tarefas automáticas) ficam de fora;
  - o custo é uma média fixa por pedido, não o que se gastou de facto;
  - a lista ainda mostra modelos que já não usamos (Gemini 3.1 Pro, 3 Flash, 2.5 Flash) e não mostra o Gemini 3 Pro Image.

## O que vou mudar

### 1. Registo de cada chamada à IA
Cada chamada ao serviço de IA, em qualquer função, passa a gravar uma linha com:
- a empresa;
- a funcionalidade;
- o **modelo que respondeu de facto**;
- se foi o plano B;
- os tokens de entrada e de saída;
- o tempo de resposta;
- se deu certo ou errado.

Só a equipa Akuris (super-admin) vê estes dados. Cada empresa continua sem ver nada de outra.

### 2. Planilha de modelos com consumo real
- Uma linha por modelo **atual**:
  - Gemini 4;
  - Gemini 3.6 Flash;
  - Gemini 3.1 Flash Lite;
  - Gemini 3 Pro Image;
  - GPT-5.4 Mini (plano B).
- Os modelos antigos só aparecem se tiverem tido uso no período, marcados como "descontinuado".
- Colunas: modelo e fornecedor, chamadas, tokens de entrada e de saída, custo real (tokens × preço), custo médio por chamada, taxa de erro e quantas vezes o plano B entrou.
- Filtro de período: este mês, 30 dias, 90 dias.
- As funcionalidades de cada modelo saem da linha: um botão "Ver funcionalidades" abre a lista. Assim a planilha fica limpa.

### 3. Visual dos itens em Configurações
- A planilha passa ao padrão de tabela do sistema, sem cortes:
  - nome do modelo e fornecedor empilhados;
  - números alinhados à direita;
  - linha de total fixa no fim.
- Os cartões de resumo do Financeiro IA passam à faixa de indicadores (StatStrip) usada no resto do sistema.
- Revejo os outros separadores de Configurações à procura dos mesmos defeitos (texto cortado, selos apertados, linhas que esticam) e corrijo-os da mesma forma.

## Detalhes técnicos
- Migration: tabela `ia_uso_modelos` (`empresa_id uuid null`, `funcionalidade text`, `modelo text`, `reserva bool`, `tokens_entrada int`, `tokens_saida int`, `duracao_ms int`, `sucesso bool`, `created_at`). RLS ligado, com SELECT só para `super_admin` e INSERT só para o service role. Índice em `(created_at, modelo)`.
- `_shared/ai.ts`: `registarUsoIA({ empresaId, funcionalidade, resposta, modelo, reserva, inicio })`. Lê `usage.prompt_tokens/completion_tokens` de um clone da resposta, sem atrasar o retorno (`EdgeRuntime.waitUntil`). É chamado dentro de `fetchAnaliseComReserva` e `callAiGateway`, e nas chamadas diretas das funções Padrão/Mecânico/Imagem.
- `src/lib/ai-usage-catalog.ts`: os preços passam a ser por 1M de tokens, conferidos na lista de modelos do gateway. Juntar Gemini 3 Pro Image, marcar os antigos com `descontinuado`, e criar a função `custoReal(modelo, tin, tout)`.
- `FinanceiroIATab.tsx`: lê `ia_uso_modelos` agregado por modelo e período. Os créditos por empresa continuam a vir de `creditos_consumo`.
- Testes:
  - o custo calculado a partir dos tokens;
  - toda a função que chama a IA regista o uso;
  - nenhuma linha some por ter empresa nula.
- Redeploy das funções de IA.
