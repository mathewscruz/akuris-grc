# Corrigir erro ao ler PDF na Avaliação de Aderência

O envio de PDF falha logo em "Preparando o arquivo". O leitor de PDF tenta baixar uma peça de um site externo (jsdelivr), e esse download é bloqueado ou falha. Por isso a análise nem começa.

## O que muda
- A peça do leitor de PDF passa a vir do próprio Akuris, sem depender de site externo. Assim funciona em qualquer rede e com as regras de segurança do site.
- Se a leitura do PDF falhar, aparece uma mensagem clara em PT/EN ("Não foi possível ler este PDF. Tente outro arquivo.") em vez do erro técnico em inglês.

## Detalhes técnicos
- `AdherenceAssessmentDialog.tsx`: importar `pdfjs-dist/build/pdf.worker.min.mjs?url` (Vite) e usar em `GlobalWorkerOptions.workerSrc`, removendo a URL do CDN.
- Envolver a extração em try/catch com mensagem traduzida via `t()` (nova chave PT/EN em `gap-adherence.ts`), registrando o detalhe com `logger`.
- Validar enviando um PDF pelo fluxo "Comprovar" e conferir que avança para "Entendendo a política".
