# Ícones dos frameworks no formato Selo (opção B)

## O que muda para o usuário
- Cada framework passa a aparecer como um **selo redondo de certificação**: aro colorido, sigla em destaque no centro (27001, SOC 2, LGPD, GDPR, NIST, PCI...), um pequeno ícone do assunto acima e, nos tamanhos grandes, o tema escrito em arco no aro ("Information Security", "Privacidade de dados" etc.).
- A cor do aro indica a família: segurança (azul), privacidade (verde-água), governança (cinza-azulado), risco (laranja), financeiro (verde), saúde (ciano), ambiente (verde-folha). Os frameworks brasileiros (BACEN, ANPD, SUSEP, CVM) entram nas famílias certas.
- Tamanhos pequenos (listas, card de Conformidade do Dashboard) mostram só aro + sigla, para ficar legível; o texto em arco aparece só nos cartões grandes do Gap Analysis.
- Vale para todos os lugares que já mostram o ícone do framework (Gap Analysis, boas-vindas, Dashboard, relatórios): são 13 telas, sem mudar nenhuma delas.
- Logotipo carregado pelo super-admin continua tendo prioridade.

## Etapas
1. Redesenhar o selo único usado por todas as telas.
2. Trocar os desenhos atuais do assunto pelos ícones Hugeicons (escudo, nuvem, pessoa com cadeado, estrelas da UE, alvo, cartão...).
3. Revisar siglas e famílias do catálogo, incluindo os frameworks regulatórios brasileiros, com o tema em PT e EN.
4. Conferir legibilidade em claro/escuro e nos três tamanhos.

## Detalhes técnicos
- `FrameworkBadge.tsx`: círculo com `ring` na cor do tom, fundo tom/10, sigla com `font-bold tracking-tight`, ícone via catálogo; texto em arco com SVG `<textPath>` só em `size="lg"`.
- `framework-brand.ts`: cores dos tons como tokens HSL em `index.css` (sem cor crua nos componentes); adicionar `tema` PT/EN por entrada e entradas BACEN/ANPD/SUSEP/CVM.
- `FrameworkGlyph.tsx`: mapa nome → ícone Hugeicons.
- Teste: siglas e família de ISO 27001, SOC 2, LGPD, GDPR, PCI DSS e BACEN 4.893.
