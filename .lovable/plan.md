# Menu lateral: espaçamento que se adapta à tela e à rotação

## O que está errado hoje
- O menu escolhe entre 3 níveis de espaço (confortável, compacto, denso). Ele só sabe "apertar": quando a tela fica mais alta (ao girar o iPad de deitado para em pé, ou ao aumentar a janela), nunca volta a afastar os ícones. Por isso no iPad tudo fica junto e a rotação não muda nada.
- Mesmo no nível confortável, o espaço é fixo: em telas altas sobra uma área vazia grande entre "Configurações" e "Sair".

## O que vai mudar
1. **Espaço distribuído pela altura disponível**: os ícones passam a ocupar toda a altura do menu, com o mesmo intervalo entre todos. Em telas altas (iPad em pé, monitores grandes) ficam mais afastados; em telas baixas, mais próximos — sempre iguais entre si e com um limite máximo para não ficarem soltos demais.
2. **Reação imediata à rotação e ao redimensionar**: o menu recalcula sempre que a altura muda, nos dois sentidos (aperta e também volta a afastar).
3. **Tamanho do ícone e texto acompanham**: ícones e nomes maiores quando há espaço, menores só quando realmente falta.
4. "Sair" continua separado embaixo; celular continua com a lista atual.

## Validação
Testar em iPad mini, Air e Pro (em pé e deitado), notebook baixo e monitor alto, simulando a rotação na mesma página, conferindo que nada é cortado, não há rolagem e o intervalo é igual.

## Detalhes técnicos
- `useAutoFit`: trocar a lógica baseada em overflow (que nunca fica negativo, por isso não regride) por cálculo a partir de `clientHeight` do contêiner ÷ número de itens, escolhendo o nível pela altura por item; ouvir `resize`, `orientationchange` e `ResizeObserver`.
- `AppSidebar`: `ul` com `flex-1 justify-between` (ou gap calculado) e `max` de espaçamento via CSS var; manter `py` uniforme.
