# Ajustes no site: ilustração do produto, rodapé e espaçamentos

## 1. Nova ilustração do produto (secção "Telas do produto")
- Substituir a demonstração antiga (tela clara de Riscos com 3 cartões, menu antigo e passos 01–04) por uma ilustração nova que reflita o Akuris atual: tema escuro navy, menu lateral estreito com o logo, painel com pontuação de conformidade, barras de maturidade por módulo, linha do tempo e cores sóbrias com roxo só nos destaques.
- Sem moldura nem caixa: a ilustração "flutua" sobre o fundo, com bordas que se dissolvem no navy e um brilho ciano/roxo discreto atrás. Remove-se também a borda animada, os passos 01–04, o botão "Pausar demonstração" e as legendas abaixo.
- Mantém-se uma leve inclinação que se endireita ao rolar.
- Os dados da ilustração são fictícios.

## 2. Rodapé
- Remover a palavra "AKURIS" gigante em contorno no fim da página. O resto do rodapé fica como está.

## 3. Espaçamentos (anexos 2 e 3)
- "Como funciona": mais espaço entre a frase "Três passos para um compliance mais simples, eficiente e contínuo." e a linha de luz com o ponto ciano.
- Mais espaço entre o texto dos três passos e a linha que fecha a secção, além de mais ar entre os títulos e as descrições dos passos.
- No celular, o mesmo respiro proporcional.

## Detalhes técnicos
- Imagem gerada (CLI `lovable image generate`, 16:10, fundo navy #0a1628 para fundir), enviada por `lovable-assets` e importada via `.asset.json`; substitui `<ProductScreens autoplay />` em `ProductPeek` (CinematicSections.tsx). `ProductScreens` continua a ser usado noutras páginas.
- CSS: `.ed-peek-frame` sem padding/gradiente/animação de borda; `mask-image` radial para dissolver as bordas; brilho via pseudo-elemento.
- Remover `<p className="ed-footer-word">` e o seu CSS.
- `.ed-steps-sub` margem inferior maior (forçar sobre `.ed-side`), `.ed-steps li` padding-top maior, padding-bottom na secção, `h3` margem 14px.
- Verificar desktop e mobile com Playwright.
