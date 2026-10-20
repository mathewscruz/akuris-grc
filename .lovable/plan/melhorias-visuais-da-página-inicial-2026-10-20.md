# Melhorias visuais da página inicial

Percorri a página inteira. A base está boa: escura, com o roxo do Akuris e telas reais do sistema. O que a enfraquece é repetição e falta de prova.

## O que mudaria

1. **Demonstração uma só vez.** Hoje a mesma demonstração animada aparece três vezes: no topo, nas abas "Requirement/Control/Evidence" e nos dois cartões "Risks/Controls". Ficaria só a do topo, maior. Mais abaixo, um único bloco de "como funciona" com 4 passos e uma imagem fixa cada.
2. **Menos texto de apoio repetido.** "Pause animations", "Pause demonstration" e o aviso "dados fictícios" aparecem 3 a 4 vezes. Passa a ser um único controlo discreto e um único aviso no rodapé da demonstração.
3. **Faixa de confiança logo abaixo do topo.** Uma linha com os selos dos frameworks que já criámos (ISO 27001, SOC 2, LGPD/RGPD, NIST, BACEN...) e "29 frameworks prontos". Hoje não há nada que mostre cobertura ou credibilidade antes de rolar.
4. **Números que vendem.** Uma faixa curta com dados reais do produto: frameworks disponíveis, cenários na biblioteca de riscos (82) e módulos ligados.
5. **Transição suave entre escuro e claro.** A secção clara "Explore the whole platform" corta a página de forma brusca. Passaria a ser escura como o resto, com os 4 grupos em cartões e os selos de módulo.
6. **Perguntas frequentes mais leves.** Texto das perguntas menor e duas colunas no computador, para não ocupar uma tela inteira.
7. **Chamada final mais forte.** O fecho "Let's talk..." ganha um cartão com o brilho roxo e o botão de demonstração, igual ao estilo do topo.

Os textos atuais, as línguas e o formulário de contacto ficam como estão.

## Detalhes técnicos
- Componentes da landing em `src/components/landing/*`: remover blocos de demonstração duplicados e reutilizar `FrameworkBadge` na faixa de confiança.
- Os números vêm de constantes já existentes (catálogo de frameworks e biblioteca de riscos), sem consultas na página pública.
- Todos os textos novos em PT-BR, pt-PT e EN via `t()`; respeitar "reduzir movimento".
- Validar com capturas no computador, tablet e celular.
