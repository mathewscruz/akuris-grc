## Problemas identificados

1. **Tela "vazia" no passo 1**: o `DocGenBriefing` só mostra os pills de tipo de documento — todo o resto do popup fica em branco. Como o template já vem com tipo pré-selecionado (ex.: PSI → "Política"), o passo 1 é redundante.
2. **Contador errado no header**: `Passo {step + 1} de 3` → mostra "Passo 2 de 3" estando no step 1 (`DocGenBriefing.tsx` linha ~123).
3. **Fluxo lento até gerar**: após o briefing o usuário cai no chat e precisa conversar para só depois disparar `generate_document`. Para templates pré-configurados isso é fricção desnecessária.
4. **Conformidade com framework não é visível no briefing**: o usuário não vê quais requisitos serão cobertos antes de gerar.

## Plano de correção

### 1. Reestruturar `DocGenBriefing` em 2 passos densos (em vez de 3 quase vazios)

**Passo 1 — "Sobre o documento"** (combina tipo + frameworks + escopo + público):
- Pills de tipo (esconder se já vier de template — mostrar como chip readonly com link "Trocar tipo")
- Frameworks aplicáveis (com sugestões puxadas do `companyContext.frameworks` da empresa, não só a lista hardcoded)
- Escopo (textarea) com placeholder dinâmico baseado no template
- Público-alvo
- **Card lateral** mostrando "X requisitos do(s) framework(s) selecionado(s) serão considerados pela IA" (contagem real consultando `framework_requisitos` por nome)

**Passo 2 — "Estilo e geração"**:
- Tom, idioma, extensão (pills atuais)
- **Toggle "Gerar direto"** (default ON quando vier de template): pula a etapa de chat conversacional e chama `generate_document` imediatamente após o seed prompt.
- Resumo final do briefing antes do botão "Gerar".

### 2. Corrigir contador
`Passo {step + 1} de 3` → `Passo {step} de 2` (com novo total).

### 3. Fluxo "Gerar direto" no `DocGenDialog`
- Em `enterChatPhase`, se `briefing.directGenerate === true`:
  - Inserir mensagem de saudação curta
  - Disparar seed prompt
  - **Encadear** chamada a `generate_document` assim que a IA responder a estrutura inicial (sem esperar input do usuário)
  - Usuário cai direto na tela de documento gerado, com opções de refinar seção por seção (já existe via `DocGenSectionRefiner`)
- Se `directGenerate === false`: comportamento atual (chat conversacional).

### 4. Pré-popular escopo do template + empresa
Quando `companyContext` estiver carregado e `briefing.scope` for o default do template, enriquecer com `setor_atuacao` e `porte_empresa` da empresa para a IA já produzir conteúdo aderente.

### 5. Mostrar contagem de requisitos cobertos
- Hook leve `useFrameworkRequirementCount(frameworkNames)` que faz `select count` em `framework_requisitos` por nome.
- Exibir no card lateral do passo 1.

## Arquivos afetados

- `src/components/documentos/DocGenBriefing.tsx` — reestruturar para 2 passos, corrigir contador, adicionar toggle "Gerar direto", card de requisitos
- `src/components/documentos/DocGenDialog.tsx` — suportar `directGenerate` no fluxo `enterChatPhase`, encadear `generate_document`
- `src/lib/docgen-templates.ts` — adicionar campo `directGenerate?: boolean` em `BriefingDefaults` (default true para templates, false para "em branco")
- `src/hooks/useFrameworkRequirementCount.ts` *(novo)* — count de requisitos por nome de framework

## Fora de escopo
- Edge function `docgen-chat` não muda (já aceita `generate_document` independentemente)
- Não mexe em UI do chat nem do documento gerado além do encadeamento automático