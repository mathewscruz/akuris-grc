# Gap Analysis: página idêntica ao modelo B

## O que muda para o usuário
1. **Cabeçalho:** eyebrow "GAP ANALYSIS", título grande e descrição em duas linhas, como no modelo. O cartão do CRA desce para baixo da tabela, como uma faixa discreta.
2. **Layout em duas colunas:** à esquerda, o conteúdo principal. À direita, a coluna "Recomendados", com ícone de brilho, título e subtítulo, ocupando a altura toda e começando no topo da página, ao lado do título.
3. **Cartão único "Aderência + Comparativo":** este cartão substitui o bloco grande de maturidade de hoje.
   - À esquerda, um anel roxo grande com o percentual e o texto "Aderência geral".
   - Uma linha vertical separa as duas partes.
   - À direita, "Comparativo entre frameworks": uma barra colorida por framework, com o nome à esquerda e o percentual à direita.
   - Cada framework tem uma cor própria, a mesma do seu selo.
4. **Cartão da tabela:**
   - Barra superior com "N frameworks" à esquerda e "Ordenar por: Aderência (maior → menor)" à direita. O menu oferece aderência, não conformes, críticos e prazo, em ordem crescente ou decrescente.
   - Busca e filtros de categoria ficam numa linha compacta acima do cartão.
   - Colunas: Framework (selo redondo, nome e categoria), Aderência (percentual e barra na cor do framework), Não conformes (vermelho), Críticos (vermelho), Próximo marco, **Responsável**, **Tendência** e Ações ("Ver detalhes →").
   - Linhas com divisória fina e mais espaço.
5. **Recomendados:** cartões empilhados com ícone, nome, chip verde "X% pronto" (só quando o valor é real), descrição de duas linhas e o link "Iniciar →".

## Dados reais para as duas colunas novas
- **Tendência:** mini gráfico de linha com o histórico de nota do framework, que o sistema já registra diariamente, filtrado por empresa. Quando há menos de 2 pontos, aparece um traço.
- **Responsável:** a pessoa com mais requisitos atribuídos naquele framework, com avatar, nome e cargo. Quando ninguém tem requisitos atribuídos, aparece "Não atribuído". Não precisa de campo novo.

## Mantido
- Os selos e as cores do Akuris, o tema claro e escuro e todos os textos em PT/EN.
- A lista de cartões no celular.
- O catálogo "Outros disponíveis" abaixo da tabela.

## Detalhes técnicos
- `GapAnalysisFrameworks.tsx`: grid `[1fr_320px]` envolvendo cabeçalho e conteúdo. Remover `MaturityHero` desta página. `CraEntry` desce para baixo da tabela.
- `FrameworksComparativo.tsx`: cartão anel + barras, cabeçalho da tabela com o `Select` de ordenação e as colunas Responsável e Tendência.
- Nova consulta, filtrada por empresa:
  - `gap_analysis_score_history` dos últimos 60 dias para os frameworks ativos;
  - contagem de `gap_analysis_evaluations.responsavel_avaliacao` por framework, cruzada com `profiles` para nome, cargo e avatar.
- Cor por framework vinda de `framework-seal-icon.ts`, com tokens CSS.
- Novas chaves i18n PT/EN. Typecheck e testes; captura autenticada quando houver sessão.
