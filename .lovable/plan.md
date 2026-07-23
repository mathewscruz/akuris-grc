
# Pente fino: DocGen gerando em compliance e mantendo em compliance

## Problema (o que o pente fino encontrou)

Ao ler o pipeline completo (`docgen-chat` → `docgen_generated_docs` → `quick_adherence` e `analyze-document-adherence`), aparecem 6 pontos que quebram a promessa de "gerado em compliance e continua em compliance após refinos":

1. **Geração sem contrato de cobertura.** O prompt de `generate_document` pede para citar `[A.8.13]` no texto, mas não devolve um mapa estruturado "requisito → seção → citação". O analisador precisa re-parsear texto livre — daí resultados instáveis.
2. **Refino é cego ao framework.** `refine_document` e `refine_section` recebem só o nome do framework — sem a lista de requisitos, sem os gaps, sem o coverage map. Um "simplifique a linguagem" pode remover cláusulas que satisfazem controles e derrubar o score sem aviso.
3. **Analisador silenciosamente ignora requisitos.** `quick_adherence` limita 150 requisitos e `analyze-document-adherence` limita 150 + 30 000 chars de documento. Frameworks grandes (PCI DSS 4.0 = 288, CIS v8 = 153) são truncados sem sinal.
4. **Fallback determinístico do score só considera "analisados".** Se a IA devolve avaliação para 30 de 121 requisitos, o score sai sobre 30 (parece bom) — os 91 silenciosos deveriam entrar no denominador como não conformes ou como "não avaliado".
5. **Frontend não usa `source: 'docgen'`.** Já criamos o caminho em memória no analisador; o `DocGenDialog` ainda depende do fluxo export→upload TXT, que perde texto e artificialmente zera o score.
6. **Refino invalida a análise mas não re-avalia.** `setAdherenceResult(null)` some com o badge; usuário exporta achando que continua 92%.

## O que este plano entrega

Um contrato único de conformidade compartilhado entre geração, refino e análise:

```text
generate_document ──► coverage_map + score inicial ──► docgen_generated_docs
        │                                                        │
        ▼                                                        ▼
   refine_section / refine_document ──► preserva/atualiza ──► re-analisa ──► novo score
                              (com lista de requisitos + gaps injetada no prompt)
```

## Onda 1 — Contrato de cobertura na geração

- Em `supabase/functions/docgen-chat/index.ts`, `generate_document`:
  - Adicionar ao JSON de saída um campo `coverage_map: [{ requirement_id, requirement_codigo, requirement_titulo, section_indexes: [n], evidencia: "citação/trecho" }]` e uma lista `requisitos_nao_cobertos_justificativa: [{ codigo, motivo }]`.
  - Passar a lista completa de requisitos (usa `fetchFrameworkRequirements`, já existe) ao prompt e obrigar a IA a marcar cada requisito relevante como coberto, parcial ou fora de escopo, com justificativa.
  - Persistir `coverage_map` dentro de `docgen_generated_docs.conteudo` (mesma coluna JSONB).
- Rodar auto-auditoria embutida: após montar o documento, chamar internamente `quick_adherence` com o `coverage_map` como âncora e devolver `initial_score` junto com o `document`. Se `initial_score < 80`, incluir `warnings` no retorno para o UI mostrar antes do usuário exportar.

## Onda 2 — Refino ciente de compliance

- Em `refine_section` e `refine_document`:
  - Injetar `fetchFrameworkRequirements(...)` + `fetchFrameworkGaps(...)` no prompt.
  - Passar o `coverage_map` atual e exigir que a IA devolva `coverage_map` atualizado indicando quais requisitos permanecem cobertos, quais foram afetados e a nova evidência.
  - Regra de sistema: "nunca remova cláusula que sustenta um requisito coberto sem substituir por equivalente".
  - Se o refino remover cobertura, o handler devolve `compliance_impact: 'reduced'` no payload e re-executa `quick_adherence` para calcular o novo score.

## Onda 3 — Analisador alinhado à fonte real do DocGen

- `supabase/functions/analyze-document-adherence/index.ts`:
  - Elevar `MAX_REQS_POR_ANALISE` para o total do framework via batching (chunks de 60 requisitos, agregando o resultado).
  - Trocar o fallback determinístico para dividir por `total_requisitos_relevantes` (que a IA já devolve) e não pelo tamanho de `requisitos_analisados`, para não mascarar requisitos silenciosos.
  - Aceitar `coverage_map` opcional no body e usá-lo como âncora de evidência (aumenta precisão do "conforme").
- `src/components/documentos/DocGenDialog.tsx`:
  - Novo botão "Análise formal" que invoca `analyze-document-adherence` com `source: 'docgen'`, `docgenDocument` (JSON em memória) e `coverage_map` — sem depender de export/upload.
  - Após qualquer `refine_section` / `refine_document` bem-sucedido, disparar automaticamente `quick_adherence` em background e atualizar o badge de compliance ao invés de zerar; se `compliance_impact === 'reduced'`, exibir toast âmbar "O refino afetou a cobertura de 3 requisitos; nova pontuação: 78%".

## Onda 4 — Validação end-to-end

- Adicionar teste manual documentado em `.lovable/plan.md` cobrindo: gerar política de mesa limpa contra ISO 27001 → verificar `initial_score ≥ 80` → refinar seção "Definições" para "linguagem simples" → confirmar que `coverage_map` mantém os mesmos códigos e o novo score fica dentro de ±5 pontos.
- Log estruturado em cada handler com `{ score_antes, score_depois, requisitos_afetados }` para diagnóstico.

## Detalhes técnicos

Arquivos:
- `supabase/functions/docgen-chat/index.ts` — handlers `generate_document`, `refine_section`, `refine_document`, `quick_adherence`.
- `supabase/functions/analyze-document-adherence/index.ts` — batching e fallback.
- `src/components/documentos/DocGenDialog.tsx` — botão "Análise formal", re-análise automática pós-refino, exibição de `warnings` e `compliance_impact`.

Modelo de dados: nenhuma migração — `coverage_map` vive dentro de `docgen_generated_docs.conteudo` (JSONB já existente). Nada muda em `gap_analysis_*`.

Créditos IA: continua 1 crédito por handler já consumido. A auto-auditoria pós-geração e re-análise pós-refino consomem crédito adicional cada — vou avisar o usuário via toast e deixar a re-análise automática opcional (default ligado, com toggle no header do diálogo).

Confirma execução das 4 ondas? Ou prefere que eu comece só pela Onda 2 (refino compliance-aware), que é o cenário exato que você descreveu?
