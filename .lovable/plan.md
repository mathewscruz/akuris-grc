# Gravidade com barra horizontal (opção C)

Os selos de gravidade (Crítico, Alto, Médio, Baixo) voltam a mostrar preenchimento: o nome vem primeiro, num fundo suave, e depois uma barra de 4 blocos.

## O que muda
- Crítico: 4 blocos preenchidos em vermelho. Alto: 3 em laranja. Médio: 2 em âmbar. Baixo: 1 em verde. Os blocos restantes ficam cinza-claro.
- O ponto colorido antes do nome sai.
- Isso vale para todos os selos de gravidade do sistema. Os selos de estado (o anel de progresso) continuam como estão.
- No modo escuro funciona da mesma forma e o nível continua acessível para leitores de tela.

## Detalhes técnicos
- `src/components/ui/chip.tsx`: no ramo `family="severity"`, troca o ponto por um `SeverityMeter` horizontal (4 segmentos de 6x4px, gap 2px, arredondados) depois do rótulo, com as cores vindas dos tokens de gravidade que já existem.
- O nível é mapeado a partir do tom (critical=4, high=3, medium=2, low=1).
- Atualizar a memória de linguagem visual com a regra: gravidade = pílula + barra horizontal; estado = anel.
- Rodar os testes de linguagem visual e de chips.
