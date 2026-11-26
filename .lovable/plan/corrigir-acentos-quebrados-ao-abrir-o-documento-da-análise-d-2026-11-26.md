# Corrigir acentos quebrados ao abrir o documento da análise de aderência

## O que aconteceu (confirmado)
- Ao analisar uma política, o sistema extrai o texto do arquivo e guarda uma cópia em **.txt** (o arquivo original não é guardado).
- Esse .txt é gravado como "texto simples" **sem indicar a codificação (UTF-8)**. Confirmei no arquivo deste caso (`…Politica_de_Governanca_e_Propriedade_de_Arquivos_-_REVISADA.txt`, enviado hoje às 13:41 UTC): está marcado só como `text/plain`.
- Quando o usuário clica em "Abrir documento", o navegador abre o .txt diretamente e, sem a indicação, lê os acentos como outra codificação (Windows-1252). Por isso "Política" vira "PolÃtica", "informação" vira "informaÃ§Ã£o".
- O texto guardado está correto, e a análise da IA não foi afetada: o problema é só na exibição.

## Correção
1. **Abrir documento** passa a baixar o arquivo e mostrá-lo já marcado como UTF-8, numa nova aba. Isso corrige na hora **todos os documentos já existentes**, sem precisar reenviar nada.
2. **Novos envios** passam a ser gravados como `text/plain; charset=utf-8`, para que o arquivo abra correto em qualquer lugar.

## Detalhes técnicos
- `src/components/gap-analysis/adherence/autoria.ts` → `abrirDocumentoAnalisado`: trocar `createSignedUrl` + navegação por `storage.download(caminho)`, criar `new Blob([await data.arrayBuffer()], { type: 'text/plain;charset=utf-8' })` e abrir `URL.createObjectURL` na janela já aberta (mantém o anti-bloqueio de pop-up); revogar a URL após 60 s. Mesmo filtro por pasta `empresa_id` (políticas de storage inalteradas).
- `AdherenceAssessmentDialog.tsx`: `File` com `type: 'text/plain;charset=utf-8'` e `upload(..., { contentType: 'text/plain; charset=utf-8' })`.
- Validar abrindo o documento deste caso no preview e conferindo os acentos.
