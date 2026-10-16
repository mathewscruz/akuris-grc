# Selos dos frameworks fiéis à proposta B

## O que está diferente hoje
- Selo pequeno (64px) com fundo quase branco: aro fino, sigla e tema minúsculos, quase ilegíveis.
- Falta o que a proposta tem: disco escuro, aro brilhante grosso, círculo interno, nome do framework no arco de cima, tema no arco de baixo, dois pontos laterais, ícone e sigla grandes.

## Como vai ficar (igual à proposta)
- **Disco escuro** (azul-marinho do Akuris) em claro e escuro, para o selo "acender" no cartão.
- **Aro externo** de 2–3px na cor da família (azul segurança, verde-água privacidade, roxo NIST, laranja pagamentos/financeiro etc.), com um leve brilho.
- **Círculo interno** mais escuro, onde ficam o **ícone** (na cor da família) e a **sigla** em branco e negrito, grande.
- **Arco de cima:** nome do framework ("ISO 27001", "SOC 2", "NIST CSF", "BACEN 4.893").
- **Arco de baixo:** o tema ("Information Security", "Trust Services", "Privacidade de dados", "Cybersecurity", "Payment Security"…), em PT ou EN.
- **Dois pontos** nas laterais do aro, como na imagem.
- Nos cartões do Gap Analysis o selo passa para ~104px (hoje 64px), com textos legíveis.
- Em lugares pequenos (listas, Dashboard) fica a versão simplificada: disco escuro, aro colorido, ícone + sigla, sem os arcos de texto (seria ilegível).
- Cores por framework como na proposta: ISO 27001/SOC 2/GDPR azul, LGPD/27701 verde-água, NIST roxo, PCI/BACEN/SUSEP/CVM laranja-dourado, etc.

## Etapas
1. Redesenhar o selo em SVG único (disco, aros, arcos de texto, pontos, ícone, sigla).
2. Adicionar tema específico por framework (não só por família) em PT/EN e a cor própria de cada um.
3. Aumentar o selo nos cartões do Gap Analysis e na tela de boas-vindas.
4. Comparar lado a lado com a imagem da proposta (captura do cartão em claro e escuro).

## Detalhes técnicos
- `FrameworkBadge.tsx`: tudo num `<svg viewBox="0 0 120 120">`: `circle` fundo `hsl(var(--fw-disc))`, aro `stroke` cor do framework 3px + `filter` drop-shadow suave, círculo interno r=34, `textPath` superior (nome) e inferior (tema), dois `circle` r=2 em 9h/3h, ícone Hugeicons via `foreignObject`-free (renderizado sobreposto em div absoluta), sigla `fill` branco `font-weight 700`.
- Novo tamanho `xl` (104px) usado por `FrameworkCard.tsx` e `WelcomeHero.tsx`; `sm/md` = versão simplificada.
- `framework-brand.ts`: campo `tema {pt,en}` e `cor` por entrada (tokens HSL `--fw-*` em `index.css`, incluindo `--fw-disc`, `--fw-nist`, `--fw-payment`).
- Teste: tema e cor de ISO 27001, SOC 2, LGPD, NIST CSF, PCI DSS.
