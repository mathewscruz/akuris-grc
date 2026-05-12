# Diagnóstico do relato do usuário

O usuário criou uma "Política Geral de Segurança da Informação" via DocGen (IA), respondeu às perguntas, gerou o documento e clicou em uma opção que ele descreveu como **"incorporar o documento"** — mas depois não conseguiu encontrar o documento no sistema.

## O que está acontecendo no código hoje

No `DocGenDialog.tsx` (preview do documento gerado), há 3 ações:
1. **"Editar Layout"**
2. **"Salvar no Sistema"** ← provavelmente o que o usuário chamou de "incorporar"
3. **"Exportar" (PDF/DOCX)**

O clique em **"Salvar no Sistema"** **não salva** o documento. Ele apenas:
1. Gera um `.docx` em memória,
2. Abre **um segundo dialog em cima do primeiro** (`DocumentoDialog` — o wizard de criação de documento),
3. Pré-preenche nome/tipo/tags e o arquivo,
4. **Espera o usuário clicar em "Salvar" de novo no wizard** para de fato persistir em `documentos` + Storage.

Se o usuário fecha esse segundo dialog (X, ESC, clique fora) ou não percebe que precisa confirmar de novo, **o documento se perde sem nenhum aviso** — o `AlertDialog` de descarte só existe no DocGen pai, não no wizard.

Além disso:
- O toast de sucesso diz só "Documento salvo!", **sem link/CTA** para o módulo Documentos. Quem abriu o DocGen de dentro de outro módulo (ex.: Gap Analysis, Controles) não tem pista de onde o documento foi parar.
- O label "Salvar no Sistema" sugere ação final de 1 clique, mas é na verdade "Abrir formulário de cadastro pré-preenchido". Há descompasso entre expectativa e realidade.
- Não há indicador de etapa ("Passo 2 de 2: confirmar dados antes de salvar").

# Mudanças propostas (somente UI/UX, sem mexer em RLS, schema ou Edge Functions)

## 1. Renomear e reposicionar a ação principal
- Botão **"Salvar no Sistema"** → **"Incorporar ao módulo Documentos"** (alinha ao vocabulário do usuário) com ícone `FileText` + `Save`.
- Adicionar microcopy abaixo do header de preview: *"Revise o conteúdo. Ao incorporar, o documento será criado em Documentos como rascunho e poderá passar por aprovação."*

## 2. Tornar o segundo dialog inequivocamente "Passo 2 de 2"
No `DocumentoDialog` quando aberto via DocGen (detectar por presença de `initialFile` + flag opcional `originSource="docgen"`):
- Eyebrow no header: **"PASSO 2 DE 2 · INCORPORAÇÃO"**
- Título: **"Confirmar dados antes de incorporar"**
- Banner discreto no topo: *"O conteúdo gerado pela IA já está anexado. Revise os metadados e clique em **Incorporar** para concluir."*
- Botão de submit muda de "Salvar" → **"Incorporar documento"**.

## 3. Guard contra fechamento acidental do wizard
- Se o `DocumentoDialog` foi aberto a partir do DocGen **e ainda não foi submetido**, ao tentar fechar (X / ESC / clique fora), exibir `AlertDialog`:
  - *"A incorporação ainda não foi concluída. Se sair agora, o documento gerado não será salvo no módulo Documentos."*
  - Ações: **"Continuar incorporação"** / **"Sair sem incorporar"**.
- O DocGen pai permanece aberto com o documento gerado intacto, então o usuário pode tentar de novo ou exportar.

## 4. Toast pós-incorporação com CTA de navegação
Após sucesso (`onSuccess`):
- Toast Sonner editorial (via `akurisToast`) com:
  - Título: **"Documento incorporado"**
  - Descrição: *"'{nome}' foi criado em Documentos como rascunho."*
  - Action button: **"Abrir em Documentos"** → navega para `/documentos` e (se possível) destaca a linha recém-criada via query param `?highlight={id}`.
- Funciona em qualquer módulo que tenha aberto o DocGen via `useDocGen().openDocGen(...)`.

## 5. Estado visual no DocGen depois de incorporar
- Após sucesso, antes de fechar o DocGen, marcar o preview com selo **"✓ Incorporado em Documentos"** por ~1.5s e então fechar — assim o usuário tem confirmação visual além do toast.

## 6. (Bônus pequeno) Tooltip explicativo nos 3 botões do preview
- "Editar Layout": *"Reorganizar seções, capa e formatação"*
- "Incorporar ao módulo Documentos": *"Salva como rascunho versionado no módulo Documentos"*
- "Exportar": *"Baixa um arquivo PDF ou DOCX (não salva no sistema)"*

# Fora de escopo
- Não mexer em `documentos` schema, RLS, Storage policies, Edge Functions, nem no parser do DocGen.
- Não alterar o pipeline de geração da IA nem o `DocLayoutBuilder`.
- Não mexer no fluxo de aprovação/versionamento existente.

# Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/documentos/DocGenDialog.tsx` | Renomear botão, microcopy, selo "incorporado", toast com CTA, propagar `originSource="docgen"` |
| `src/components/documentos/DocumentoDialog.tsx` | Aceitar `originSource` opcional, header "Passo 2 de 2", label do submit, guard de fechamento sem submissão |
| `src/pages/Documentos.tsx` (apenas se trivial) | Suportar `?highlight={id}` para destacar linha recém-criada (caso contrário, ficar só com a navegação simples) |

# Resposta para o usuário (depois de implementar)
Explicar que o "incorporar" era na verdade um fluxo de 2 passos onde o segundo dialog passava despercebido, que reorganizamos a interface para deixar claro e que agora há um link direto pro módulo Documentos no toast de confirmação.
