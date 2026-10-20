# Acabar com a tela branca antes do carregamento

## Porque acontece
Ao abrir o Akuris, o navegador mostra a página vazia enquanto descarrega o sistema. Nesse intervalo:
- a página ainda não tem cor de fundo definida, por isso aparece branca;
- o tema escuro só é aplicado depois de o sistema arrancar, por isso quem usa o escuro vê branco e depois azul-marinho;
- a animação de carregamento também só aparece depois de o sistema arrancar.

## O que vou fazer
1. Definir a cor de fundo logo no primeiro instante, já no tema certo (claro ou escuro) que a pessoa escolheu.
2. Mostrar de imediato uma versão leve da animação de carregamento do Akuris. Ela é substituída sem salto pela animação normal quando o sistema arrancar.
3. Guardar sempre a última escolha de tema neste aparelho, para o passo 1 acertar também antes do login.
4. Confirmar no navegador, com a ligação lenta simulada, que não aparece mais nenhum quadro branco, nos dois temas.

## Detalhes técnicos
- `index.html`: script inline no `<head>` que lê `akuris.theme` e aplica a classe `dark` em `<html>`; `<style>` inline com `html,body{background}` para claro (`hsl(210 20% 98%)`) e escuro (`hsl(216 60% 8%)`) e `color-scheme`.
- `#root` com marcação estática do loader (SVG do "A" com o mesmo traço e as mesmas cores), que o React substitui ao montar.
- `ThemeContext`: ao gravar o tema por utilizador, gravar também `akuris.theme` global.
- Teste: o `index.html` contém o fundo inline e o script de tema.
- Verificação com Playwright: limitação de rede e captura do primeiro quadro.
