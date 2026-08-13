# Orientações de requisito bilíngues e reaproveitadas entre empresas

## Situação atual (verificada)

- O texto de "Requirement Guidance" (o que significa, por que importa, evidências, perguntas de diagnóstico) é gerado pela IA e **já é gravado na tabela global de requisitos** (`gap_analysis_requirements`, que não tem coluna de empresa). Ou seja, o conteúdo já é compartilhado entre todas as empresas — mas hoje isso não é usado de forma explícita: a tela só gera quando o campo está vazio, e o botão "Regenerate" sobrescreve o texto global sem nenhum aviso.
- Existem 1.573 requisitos no banco; apenas 33 têm orientação em português e **nenhum tem versão em inglês**. Por isso, com o app em inglês, o card aparece todo em português (fallback para PT).

## O que será feito

### 1. Orientações em inglês
- A geração passa a receber o idioma da tela. Em inglês, a IA escreve o conteúdo em inglês e ele é salvo nas colunas em inglês já existentes (`orientacao_implementacao_en`, `exemplos_evidencias_en`, `perguntas_diagnostico_en`); em português, continua salvando nas colunas atuais.
- A tela passa a considerar "faltando" apenas o conteúdo do idioma atual: se existe PT mas não EN, ao abrir em inglês o sistema gera (uma única vez) a versão em inglês em vez de mostrar o texto em português.
- Quando já existir a versão em português, a IA **traduz/adapta** esse texto para o inglês em vez de criar do zero, para as duas versões continuarem consistentes.

### 2. Reaproveitamento entre empresas (cache global)
- Antes de chamar a IA, a função confere se o requisito já tem conteúdo salvo naquele idioma. Se tiver, devolve o texto salvo, **sem chamar a IA e sem consumir crédito** da empresa.
- Crédito de IA só é debitado quando o conteúdo é realmente gerado pela primeira vez (ou regenerado manualmente).
- O "Regenerate" continua disponível, mas atualiza somente o idioma atual e passa a ser restrito a super-admin, já que altera um conteúdo global visto por todas as empresas. Para os demais usuários o botão fica oculto.
- A aba **Traduções** em Configurações ganha a opção de gerar em lote as orientações em inglês dos frameworks (mesma mecânica já usada para títulos e descrições).

## Detalhes técnicos

- `supabase/functions/populate-requirement-guidance/index.ts`
  - Aceita `locale` ('pt' | 'en') e `force` no corpo da requisição (validados).
  - Mapeia colunas por idioma: sufixo `_en` quando `locale = 'en'`.
  - Curto-circuito de cache: se a coluna do idioma já estiver preenchida e `force !== true`, retorna o conteúdo salvo com `cached: true`, sem `consume_ai_credit`.
  - Prompt em inglês quando `locale = 'en'`; se houver texto PT salvo, ele entra no prompt como base para tradução fiel.
  - Modo lote passa a filtrar pelos campos do idioma solicitado.
  - `force = true` exige `has_super_admin_role`.
- `src/components/gap-analysis/dialogs/RequirementDetailDialog.tsx`
  - `triggerGuidanceGeneration` envia `locale` (de `getAppLocale()`) e `force`.
  - A checagem `if (!details.orientacao_implementacao)` passa a olhar diretamente a coluna do idioma corrente (sem fallback), para disparar a geração do inglês quando faltar.
  - Botão "Regenerate" só renderiza para super-admin.
- `src/components/gap-analysis/adherence/AdherenceAssessmentView.tsx`: mesma lógica de idioma ao exibir/gerar orientação.
- `src/components/configuracoes/TraducoesTab` (aba existente): novo botão "Traduzir orientações" que chama a função em modo lote com `locale: 'en'`.
- Nenhuma migração de banco é necessária — as colunas `_en` já existem.
- Sem impacto em scoring: apenas exibição e geração de texto.
