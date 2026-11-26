# Documento da política ainda abre com acentos quebrados

## O que foi verificado
- A foto mostra o endereço antigo do arquivo (link assinado do armazenamento), aberto direto numa aba do navegador.
- No código atual, nenhum botão gera mais esse link para documentos de análise de aderência: "Abrir documento" abre o leitor dentro do sistema, com acentos corretos.
- Conclusão: o usuário está usando a versão publicada (akuris.pt), que ainda não recebeu as correções. Elas só existem na pré-visualização.

## O que fazer
1. Publicar a versão atual, para que akuris.pt passe a usar o leitor interno.
2. Depois de publicar, abrir a política em akuris.pt e confirmar que abre no painel do Akuris, com acentos certos.
3. Pedir ao usuário que recarregue a página (Ctrl+Shift+R) para sair da versão antiga guardada no navegador.
4. Proteção extra: se alguém abrir um link antigo salvo, ele continuará quebrado, porque é o navegador lendo o arquivo puro. Para eliminar isso de vez, regravar os arquivos `.txt` já existentes no armazenamento com a codificação UTF-8 declarada (mesmo conteúdo, só a etiqueta muda).

## Detalhes técnicos
- Script único (service role) que lista objetos `text/plain` do bucket `adherence-documents`, baixa e regrava cada um com `contentType: 'text/plain; charset=utf-8'` e `upsert: true`, mantendo o caminho (por empresa). Sem mudança de código nem de permissões.
