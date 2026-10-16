# Resultado que instrui: "Esta política está em compliance com a norma?"

O objetivo: o usuário envia a política em "Comprovar" e recebe uma resposta direta e um guia do que fazer. Hoje o resultado diz *o que* ajustar, mas explica pouco *por que* e *como*. O plano fecha essa lacuna.

## 1. Resposta direta no topo
- Frase em linguagem simples: "Sim, sua política atende a ISO 27001" / "Quase — faltam 3 ajustes" / "Ainda não — faltam pontos essenciais".
- Nota em anel, veredito e um resumo de 2–3 linhas do porquê.

## 2. Se estiver em compliance
- Tela de parabéns (ícone de conclusão animado), lista curta do que a política cobre bem, com trechos citados.
- Próximo passo em um clique: "Usar como evidência nos requisitos" (já existe) e "Exportar parecer em PDF".
- Pequenas melhorias opcionais aparecem separadas, como "Boas práticas" — não como pendência.

## 3. Se não estiver: cada ajuste vira uma instrução completa
Cada cartão, ao abrir, mostra:
1. **O que a norma exige** — o requisito em linguagem simples (ex.: "A ISO pede que a política seja aprovada pela alta direção").
2. **O que encontramos no seu documento** — trecho citado ou "não encontramos menção a…".
3. **Por que isso importa** — impacto numa auditoria (ex.: "auditor registra não conformidade").
4. **Como corrigir** — 2 a 4 passos práticos.
5. **Sugestão de texto** — parágrafo pronto para colar na política, com botão Copiar.
6. Ações: "Criar plano de ação" e "Marcar como resolvido na próxima versão".

Ajustes agrupados em "Essenciais para estar em compliance" e "Recomendados", com uma barra "Faltam X para ficar em compliance".

## 4. Caminho para o compliance
- Bloco final "Seus próximos passos": 1) aplicar os ajustes, 2) enviar nova versão, 3) usar como evidência. A comparação entre versões ("3 resolvidos, 1 pendente") continua.
- PDF exportado segue a mesma estrutura (resposta, ajustes com porquê e como, sugestões de texto).

## Detalhes técnicos
- `analyze-document-adherence`: ampliar o formato pedido à IA na etapa de interpretação para cada ação incluir `exigencia_norma`, `evidencia_documento` (citação ou ausência), `impacto`, `passos[]`, `texto_sugerido`, `essencial: boolean`; pontos fortes já trazem citação. Proibir inventar citações (só trechos do texto lido). Sem custo extra de crédito (mesma chamada).
- Análises antigas sem esses campos continuam exibindo o formato atual.
- `AdherenceResultView.tsx`: estados "em compliance" e "ajustes" distintos; cartões expansíveis com as 5 seções; copiar texto; agrupamento essencial/recomendado.
- `ExportPDF.tsx` com as novas seções; chaves PT/EN em `gap-analysis.ts`.
- Teste: regra de veredito inalterada; teste de que ações sem campos novos ainda renderizam.
- Redeploy da função e verificação do formato de resposta.
