
## Objetivo
Percorrer o fluxo real do DocGen como usuário (briefing → geração → refino via chat → refino de seção → análise de aderência → publicação em Documentos), corrigir o que estiver quebrado e elevar a qualidade do documento gerado.

---

## Onda 1 — Simulação ponta a ponta (diagnóstico)

Rodar Playwright headless contra `http://localhost:8080` usando a sessão Supabase já injetada:

1. Abrir `/documentos` e disparar o DocGen (`useDocGen().openDocGen`).
2. Responder o briefing conversacional para uma **Política de Mesa Limpa** (ISO 27001).
3. Acionar **Gerar documento** e capturar `initial_score`, `coverage_map`, warnings.
4. Enviar mensagem de refino no chat ("adicione responsabilidades do DPO e um item sobre impressoras compartilhadas") — validar `refine_document` e atualização do preview.
5. Abrir **Refinar seção** em 1 seção — validar `refine_section` e `compliance_impact`.
6. Rodar **Análise rápida de aderência** (`quick_adherence`) e comparar score com `initial_score` (esperado: ≥ 80% e paridade).
7. Clicar **Publicar em Documentos** → confirmar `DocumentoDialog` recebe arquivo, tipo, categoria, framework e persiste em `documentos` com `origin_source='docgen'`.
8. Recarregar `/documentos` e confirmar que aparece na lista com metadados corretos.

Cada passo gera screenshot em `/tmp/browser/docgen/screenshots/` + log de console/rede. O relatório da Onda 1 vira a lista final de bugs.

---

## Onda 2 — Correções de fluxo (o que a Onda 1 revelar)

Placeholders esperados com base no código atual:

- **Anexar arquivo gerado ao salvar**: hoje `initialGeneratedFile` só é setado se o usuário exportar antes; garantir que **Publicar em Documentos** gere o DOCX in-memory e passe para `DocumentoDialog` mesmo sem export manual.
- **Vincular framework ao documento salvo**: `initialData` não envia `framework_id` nem `requirement_id`; incluir para o documento nascer já linkado à Análise de Aderência.
- **Anexar `coverage_map` como metadado JSON do documento** (para reuso pelo analisador oficial sem re-inferência).
- **Categoria automática**: mapear `currentDocType` → categoria correspondente (política/procedimento/norma) via `docgen_categorias` em vez de deixar o usuário escolher toda vez.
- **Bloquear "Publicar" enquanto `isGeneratingDoc` ou refino em andamento** para evitar salvar snapshot desatualizado.
- **Persistir versão + snapshot JSON** em `docgen_generated_documents` (se a tabela existir) para trilha de auditoria do próprio DocGen.

---

## Onda 3 — Qualidade da geração (o núcleo do pedido)

Alvo em `supabase/functions/docgen-chat/index.ts` handler `generate_document`:

1. **Modelo mais forte para o corpo do documento**: trocar `google/gemini-3-flash-preview` por `google/gemini-3-pro-preview` (ou `anthropic/claude-3-5-sonnet` conforme `ai/model-selection-strategy-2025`) apenas para `generate_document` e `refine_document`. `chat` e `quick_adherence` continuam no flash (economia de crédito). Temperatura 0.3, `max_tokens` 24000.
2. **System prompt de qualidade editorial** (novo, sobrepõe o atual):
   - Persona: consultor sênior GRC com estilo Big4.
   - Estrutura obrigatória para toda política/procedimento: `Objetivo`, `Escopo e Aplicabilidade`, `Termos e Definições`, `Papéis e Responsabilidades` (tabela RACI textual), `Diretrizes/Procedimentos` (numeradas 1., 1.1, 1.2), `Controles e Medidas de Segurança`, `Indicadores e Métricas`, `Exceções e Desvios`, `Vigência, Revisão e Comunicação`, `Referências Normativas`, `Histórico de Revisões`.
   - Regras de redação: voz ativa, verbos imperativos ("deve", "não deve"), evitar frases genéricas, incorporar literalmente valores/prazos/sistemas citados no briefing, sem "lorem ipsum" nem "[preencher]".
   - Cada cláusula que atende requisito recebe `[CÓDIGO]` inline (já pedido, reforçar).
3. **Quality gate pós-IA** (determinístico, no próprio Edge Function):
   - Seções com `< 200` chars ou contendo `[preencher|inserir|exemplo|TBD]` → 1 retry automático pedindo para reescrever apenas as seções fracas (sem cobrar novo crédito, mesma conversação).
   - Se ao final ainda houver seção fraca, marcar no warnings.
   - Se `coverage_map` estiver vazio mas houver framework, forçar retry pedindo o mapa (regra atual só avisa).
4. **Enriquecer contexto**: incluir no prompt o **guia de implementação** e **exemplos de evidência** de cada requisito relevante (já buscado em `fetchFrameworkRequirements`; verificar se está incluindo o guidance completo — se estiver truncado, aumentar para 800 chars/requisito).
5. **Metadados de saída**: acrescentar `siglas_glossario`, `versoes_historico`, `matriz_raci` em `documentContent.metadados` para render mais rico no preview e exports.

---

## Onda 4 — Exportação (PDF/DOCX) mais profissional

Alvo em `DocGenDialog.tsx` (`generatePdfBlob`, `generateDocxBlob`):

- **PDF**: capa dedicada com logo grande + título + classificação + versão + data + empresa; página em branco para sumário automático (com números de página reais); cabeçalho e rodapé em todas as páginas (nome do doc + confidencialidade + `pág X de Y`); numeração hierárquica; quebra de página entre seções principais; fontes: título 22pt bold, H2 14pt bold, corpo 11pt justificado com entrelinha 1.4.
- **DOCX**: usar `HeadingLevel.HEADING_1/2/3`, `TableOfContents` (docx suporta via `TableOfContents`), header/footer com `PageNumber`, estilos consistentes. Renderizar Papéis/Responsabilidades como `Table` real quando `matriz_raci` estiver presente.
- **Tanto PDF quanto DOCX**: renderizar Histórico de Revisões e Referências Normativas como tabela.

---

## Onda 5 — Reexecutar simulação e validar

Rodar a mesma bateria da Onda 1, comparando *antes/depois*:
- `initial_score` ≥ 80% para o caso ISO 27001 Mesa Limpa (baseline).
- Documento salvo em `/documentos` já vinculado ao framework e com `coverage_map` anexado.
- Preview do PDF/DOCX inspecionado imagem por imagem (renderizar as páginas com PIL antes de entregar).
- Rodar `docgen-chat/compliance_test.ts` para confirmar que Onda 3 não quebrou a fórmula compartilhada.

---

## Detalhes técnicos (para a equipe)

**Arquivos que serão editados:**
- `supabase/functions/docgen-chat/index.ts` — modelo, prompt, quality gate.
- `src/components/documentos/DocGenDialog.tsx` — auto-anexar DOCX na publicação, vincular framework, PDF/DOCX profissionais, gate no botão Publicar.
- (Opcional) `src/lib/docgen-templates.ts` — nova baseline de estrutura Big4 usada pelo prompt.

**Não muda:** `_shared/compliance-score.ts`, testes existentes, fluxo de créditos, RLS.

**Nenhuma migration** necessária a princípio (se a Onda 1 revelar necessidade de coluna `coverage_map` em `documentos`, incluir).

**Custo IA:** troca do modelo aumenta ~2–3× o custo por geração; refino de seção continua no flash barato.
