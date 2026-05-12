# Plano — Evolução do DocGen para gerar políticas reais

Transformar o DocGen de "chat em branco com IA" para um **assistente editorial guiado** que produz políticas e documentos realmente alinhados à empresa, ao framework e ao tipo de documento. Mantém compatibilidade com o fluxo de incorporação atual (passo 2 do `DocumentoDialog`).

---

## Onda 1 — Briefing estruturado + biblioteca de templates
**Impacto: Alto · Esforço: Médio**

### 1.1 Novo passo "Briefing" antes do chat
Substitui o `Textarea` em branco por um wizard de 3 telas dentro do próprio `DocGenDialog`:

```
PASSO 1 · TIPO         PASSO 2 · ESCOPO         PASSO 3 · TOM E IDIOMA
────────────────       ──────────────────       ──────────────────────
○ Política             Frameworks aplicáveis    Tom: ◉ Formal corporativo
○ Procedimento         (multi-select dos        ○ Técnico
○ Norma interna         frameworks da empresa)  ○ Didático
○ Plano                Áreas/processos          Idioma: ◉ PT-BR  ○ EN
○ Termo                cobertos (free text)     Extensão: ◉ Padrão (8-15 págs)
○ Em branco            Público-alvo             ○ Executivo (3-5)  ○ Detalhado (20+)
```

Estado guardado em `useState<BriefingForm>` no `DocGenDialog`. Persistido no `useWizardDraft` (já existe) sob `storageKey="docgen-briefing"`.

### 1.2 Biblioteca de templates pré-configurados
Nova tela "Começar a partir de…" exibida antes do briefing (com opção "Pular → começar do zero"):

| Categoria | Templates iniciais |
|---|---|
| Segurança da Informação | PSI (ISO 27001), Política de Senha, Política de Acesso, Política de Backup, Plano de Resposta a Incidentes |
| LGPD / Privacidade | Política de Privacidade, Política de Cookies, Procedimento de Atendimento ao Titular, Política de Retenção |
| Continuidade | Plano de Continuidade (BCP), Plano de Recuperação (DRP), Política de Crise |
| Governança | Código de Conduta, Política Antissuborno, Política de Conflito de Interesses |
| Operacional | Procedimento de Onboarding, Política de Home Office, Política de Uso Aceitável |

Cada template = arquivo TS em `src/lib/docgen-templates.ts` com:
```ts
{ id, label, category, frameworks: ['iso-27001'], briefingDefaults: {...}, seedPrompt: string, suggestedSections: string[] }
```

Cards renderizados com ícone proprietário do módulo correspondente (`ShieldIcon`, `LockIcon`, etc.) seguindo `akuris-icon-system`. Selecionar um template **pré-preenche** o briefing; usuário ainda revisa/ajusta antes de gerar.

### 1.3 Geração inicial automática
Após briefing concluído (ou template + briefing), DocGen monta o `seedPrompt` e dispara a primeira chamada à `docgen-chat` automaticamente — sem exigir que o usuário escreva o primeiro prompt. Chat permanece aberto para refinamento posterior.

---

## Onda 2 — Contexto automático da empresa
**Impacto: Alto · Esforço: Médio**

### 2.1 Painel lateral "Contexto da empresa"
Novo `<Collapsible>` à direita do chat (ou aba em mobile) mostrando o que a IA está usando:

```
┌─ CONTEXTO DA EMPRESA ────────────┐
│ Razão social    Akuris Tecnologia│
│ Segmento        SaaS B2B         │
│ Porte           Médio (51-200)   │
│                                  │
│ FRAMEWORKS ATIVOS                │
│ • ISO 27001  78%                 │
│ • LGPD       65%                 │
│                                  │
│ ATIVOS CRÍTICOS    12            │
│ RISCOS ALTOS        3            │
│ CONTROLES MAPEADOS 47            │
│                                  │
│ ☑ Incluir tudo no contexto       │
│ ☐ Apenas razão social + segmento │
└──────────────────────────────────┘
```

Toggle controla quanto contexto é injetado no prompt de sistema da edge function.

### 2.2 Edge function `docgen-chat` — enriquecimento de contexto
Adicionar antes da chamada ao gateway:
- `select` em `empresas` (razão social, segmento, porte, cnpj — sem dados sensíveis no prompt)
- `select count` em `ativos`, `riscos` (status='alto'), `controles` ativos
- `select` em frameworks da empresa (`empresa_frameworks` + score atual)
- Se `requirementContext` presente, injetar requisito + guidance
- Tudo concatenado no `system` message com seção `## Contexto operacional da empresa`

Respeita `.eq('empresa_id', empresaId)` em todas as queries (regra Core).

### 2.3 Microcopy de transparência
Logo abaixo do chat: *"A IA está considerando: Akuris Tecnologia · ISO 27001 · 12 ativos críticos · 3 riscos altos."* — usuário sabe exatamente o que foi enviado.

---

## Onda 3 — Refinamento por seção + validação inline
**Impacto: Alto · Esforço: Alto**

### 3.1 Editor por seção no preview
Hoje o preview é um único bloco. Mudar para uma lista de seções (extraídas dos `##` do markdown gerado) com hover-actions:

```
## 1. Objetivo                         [✎ Refinar com IA] [↻ Regenerar] [🗑]
Lorem ipsum dolor sit amet...

## 2. Escopo                           [✎ Refinar com IA] [↻ Regenerar] [🗑]
...
```

- **Refinar com IA**: abre popover inline com prompt direcionado *"O que melhorar nesta seção?"* (ex.: "deixar mais técnico", "adicionar exemplos LGPD", "encurtar"). Chama `docgen-chat` com `mode=refine_section` enviando só a seção + instrução.
- **Regenerar**: regenera apenas aquela seção mantendo o resto.
- **Adicionar seção**: botão `[+ Adicionar seção]` entre blocos.

Estado das seções em `useState<DocSection[]>` derivado do markdown via parser simples (`splitByH2`).

### 3.2 Validação de aderência inline
A edge function `analyze-document-adherence` já existe. Plugar no DocGen:

- Botão **"Validar aderência"** no header do preview (ao lado de Editar Layout / Incorporar / Exportar).
- Dispara análise contra os frameworks selecionados no briefing.
- Resultado renderizado como **selos coloridos por seção** + painel lateral:

```
┌─ ADERÊNCIA · ISO 27001 ──────────┐
│ Score geral        82%  ●●●●○    │
│                                  │
│ ✓ Cobre A.5.1 (Política)         │
│ ✓ Cobre A.6.1 (Funções)          │
│ ⚠ Parcial A.8.2 (Classificação)  │
│ ✗ Faltando A.9.1 (Acesso)        │
│                                  │
│ [Aplicar sugestões da IA]        │
└──────────────────────────────────┘
```

Botão "Aplicar sugestões" gera as seções faltantes automaticamente via `docgen-chat`.

### 3.3 Custos de IA — controle
- Cada refinamento de seção = 1 crédito (igual a uma mensagem de chat).
- Validação de aderência = já é cobrada pela edge `analyze-document-adherence`.
- Preview de custo no botão: *"Validar (1 crédito)"*.

---

## Melhorias transversais (entram nas 3 ondas)

- **Auto-save real do documento gerado** em `localStorage` por `empresa_id`+`requirementId` para nunca perder rascunho.
- **Markdown rendering de verdade** no chat e no preview (já estamos puxando markdown mas não renderizando como tal em alguns pontos) usando `react-markdown` + `prose prose-sm` (já no projeto).
- **Suggestion chips** abaixo do input do chat: "Adicionar seção sobre teletrabalho", "Endurecer linguagem", "Traduzir para inglês".
- **Mobile**: tabs `[Briefing] [Chat] [Preview] [Contexto]` em vez de split horizontal.
- **AkurisPulse** como único loader (regra Core), tooltips com `strokeWidth={1.5}` (assinatura Akuris).
- **Sem cores Tailwind cruas** em selos de aderência — usar `StatusBadge` + `status-tone.tsx`.

---

## Fora de escopo
- Não mexer em RLS, schema de `documentos`, Storage policies.
- Não alterar fluxo de aprovação/versionamento existente.
- Não tocar no `DocumentoDialog` (passo 2 da incorporação) — já foi corrigido na iteração anterior.
- Não trocar provider de IA — segue Lovable AI Gateway.

---

## Arquivos afetados

**Onda 1**
- `src/lib/docgen-templates.ts` *(novo)* — catálogo de templates
- `src/components/documentos/DocGenBriefing.tsx` *(novo)* — wizard de 3 passos
- `src/components/documentos/DocGenTemplateGallery.tsx` *(novo)* — galeria
- `src/components/documentos/DocGenDialog.tsx` — orquestração: gallery → briefing → chat → preview

**Onda 2**
- `src/components/documentos/DocGenContextPanel.tsx` *(novo)*
- `supabase/functions/docgen-chat/index.ts` — enriquecer system prompt com contexto da empresa
- `src/components/documentos/DocGenDialog.tsx` — montar/passar contexto

**Onda 3**
- `src/components/documentos/DocGenSectionEditor.tsx` *(novo)*
- `src/components/documentos/DocGenAdherencePanel.tsx` *(novo)*
- `supabase/functions/docgen-chat/index.ts` — modos `refine_section` e `regenerate_section`
- `src/components/documentos/DocGenDialog.tsx` — integrar editor + aderência

---

## Sequência de entrega proposta
1. **Onda 1 isolada** (briefing + templates + geração automática) — entrega já melhora drásticamente a usabilidade. Testa-se por completo antes de seguir.
2. **Onda 2** depois de validar Onda 1 (envolve mexer na edge function).
3. **Onda 3** por último (mais complexa, depende das anteriores).

Posso começar pela **Onda 1** assim que aprovar — ou se preferir entrego as três de uma vez.
