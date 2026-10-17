# Validação e estruturação do conteúdo dos requisitos dos frameworks

## O que a validação encontrou (29 frameworks, 1.757 requisitos)
- **Nenhum requisito vazio:** todos têm descrição, orientação e evidências esperadas, em PT e em EN.
- **Orientações fora do padrão (69):** são textos antigos de "conversa", com "Com certeza! Aqui está…", emojis e metáforas, sem os passos "Faça nesta ordem". Foi o caso da tela que você mostrou (ISO 27001 4.1). Distribuição:
  - CRA: 30
  - ISO 27001: 19
  - LGPD: 6
  - SOC 2: 5
  - ISO 9001: 4
  - Outros 5 em vários frameworks.
- **Descrições curtas demais (~430):** a descrição repete só o título (ex. ISO 9001 "Tratar não conformidades"; NIST CSF "Os riscos são monitorados continuamente"). O usuário não vê o que a norma exige. Concentração:
  - ISO 9001: 50 de 50
  - NIST CSF: 43
  - COBIT: 39
  - ISO/IEC 20000: 39
  - ISO 37301: 37
  - ITIL: 33
  - SOX: 30
  - ISO 14001: 23
  - COSO ERM: 20
  - ISO 31000: 19
  - COSO Internal Control: 17
  - ISO 27701: 15
  - HIPAA: 13
  - CCPA: 10
  - e poucos em outros.
- **Evidências fora de lista (8, no CRA):** viram um parágrafo, não itens que se possa marcar.
- **Na tela:** o bloco "Como cumprir" mistura tudo numa lista só, e aparecem frases como "Vulnerabilidades desconhecidas…" no lugar dos passos. A lista pega qualquer marcador do texto, sem respeitar as seções.

## O que será feito

### 1. Conteúdo (dados globais, em PT e EN)
- **Reescrever as 69 orientações fora do padrão** no mesmo formato das demais, sem saudação, emoji ou metáfora:
  - **Entenda o requisito:** 2 a 3 frases.
  - **Faça nesta ordem:** passos numerados e práticos.
  - **Como comprovar:** o que mostrar ao auditor.
  - **Erros comuns.**
- **Ampliar as ~430 descrições curtas** para uma frase completa do que é exigido ("A organização deve…"), escrita com as nossas palavras, sem copiar o texto oficial das normas. O título continua igual.
- **Converter as 8 evidências do CRA** em lista de itens.
- Esse conteúdo é da plataforma: não consome créditos de IA dos clientes, e os requisitos dos clientes não são duplicados.

### 2. Tela do requisito
- **Como cumprir** passa a ler as seções:
  - "Entenda o requisito" aparece como parágrafo curto no topo;
  - "Faça nesta ordem" aparece como passos numerados, todos visíveis;
  - "Como comprovar" e "Erros comuns" ficam em "Ver orientação completa".
- Se um texto não tiver seções, mostra o texto formatado, como hoje, nunca uma lista misturada.
- **Evidências esperadas** sempre em lista, com "Encontrada" ou "Faltando". A descrição completa fica no bloco **Requisito**.

### 3. Proteção para não voltar a acontecer
- Um teste automático e uma checagem no banco acusam quando um requisito global tem:
  - descrição igual ao título ou com menos de 40 caracteres;
  - orientação sem "Faça nesta ordem" ou com saudação ou emoji;
  - evidências que não estão em lista.
- A geração automática de orientações passa a rejeitar textos com saudação ou emoji e a exigir as seções.

## Detalhes técnicos
- Os UPDATEs vão direto em `gap_analysis_requirements` dos frameworks globais (`empresa_id IS NULL`). Os textos são gerados por mim em lote, por framework, em PT e EN, e aplicados em blocos.
- `RequirementDrawer`: novo `parseOrientacao(md)`, que separa as seções pelos títulos `##` (PT e EN: Entenda/Understand, Faça nesta ordem/Do this in order, Como comprovar/How to prove, Erros comuns/Common mistakes).
- A edge function de orientação ganha uma validação de formato antes de gravar, reaproveitando a sanitização que remove o texto antes do primeiro `##`.
- Teste novo `src/lib/__tests__/parse-orientacao.test.ts`. Ao final, a checagem SQL de auditoria deve retornar 0 em cada categoria.
