# Ajustes na nova página inicial

## 1. Retirar o rótulo da abertura
Remover "Governança • Risco • Compliance" acima do título (PT e EN).

## 2. Secções mais integradas
Hoje cada bloco tem fundo e limites próprios, por isso a página parece "cortada".
- Fundo contínuo único com brilhos roxos suaves que passam de uma secção para a outra, sem linhas duras.
- A abertura dissolve-se para a secção seguinte com um degradê, sem borda.
- A faixa de frameworks deixa de ser uma barra solta e passa a fazer parte do fim da abertura.
- Espaçamento vertical uniforme entre secções e o mesmo estilo de rótulo e título em todas.
- Elementos aparecem suavemente ao rolar a página (desligado em movimento reduzido).

## 3. Ícones dos frameworks mais reais
Trocar os ícones genéricos por recriações em SVG fiéis à identidade visual de cada um, em versão monocromática clara para combinar com o fundo escuro:
- ISO 27001 / ISO 27701 / ISO 22301: selo ISO com o globo e as letras.
- SOC 2: selo circular azul da AICPA.
- LGPD: escudo com as cores da bandeira do Brasil.
- RGPD / GDPR: círculo de 12 estrelas da União Europeia.
- NIS2 e DORA: estrelas da UE com a sigla.
- NIST CSF: logótipo NIST.
- PCI DSS: escudo PCI.
Nota: são representações para identificar cada norma, e não logótipos oficiais licenciados.

## 4. Revisão do que o cliente entende (e correções)
O que encontrei a ler a página como um possível cliente:
- O título fala em "estar um passo à frente", mas não diz o que o Akuris é. Correção: subtítulo claro, por exemplo "Plataforma de GRC que reúne riscos, controles, evidências, privacidade e auditorias, com IA para acelerar a conformidade".
- Os benefícios são genéricos ("Reduza riscos"). Correção: benefícios concretos com resultado, como "Gap Analysis com IA por framework", "Evidências reaproveitadas entre normas" e "Relatórios prontos para auditoria".
- Só 6 dos módulos aparecem. Correção: os 6 principais continuam em destaque e uma linha abaixo lista os restantes (Ativos, Contratos, Fornecedores, Incidentes, Denúncias, Documentos, Projetos, Planos de ação, Revisão de acessos) com ícone.
- Não há nenhuma imagem do produto. Correção: nova secção "Veja o Akuris por dentro" com as telas animadas que já existem, numa moldura com brilho.
- Falta saber para quem é. Correção: bloco "Para quem é" com 3 perfis (Segurança da Informação/CISO, Compliance e Jurídico/DPO, Auditoria e Riscos), cada um com o que ganha.
- Faltam as dúvidas que travam a decisão. Correção: perguntas frequentes curtas de volta, antes da chamada final.
- Botão "Ver como funciona" ao lado de "Pedir demonstração" na abertura, para quem ainda não quer falar com vendas.

Ordem final: Abertura (com faixa de frameworks) → Sobre e números → Módulos → Veja por dentro → Como funciona → Para quem é → Perguntas frequentes → Chamada final → Rodapé.

## Detalhes técnicos
- `CinematicSections.tsx`: remover o eyebrow; novos `ProductPeek`, `Audience`, `FaqCompact`, `ModuleChips`; `FrameworkMarquee` movida para dentro de `HeroCinematic`; ícones em novo `FrameworkLogos.tsx` (SVG inline, `currentColor` + cor de marca).
- CSS: um só fundo em `.public-cinematic main` com camadas radiais, retirar `border-block` e fundos individuais das secções, revelação com `useLandingReveal` já existente.
- Textos novos PT/EN em `site.ts`; perguntas reaproveitam `publico.landing.faq.*` e o JSON-LD de FAQ volta à página.
- Verificar no navegador em desktop e telemóvel.
