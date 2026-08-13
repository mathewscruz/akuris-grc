# Varredura definitiva de internacionalização

## Objetivo
Eliminar textos visíveis em português quando o idioma selecionado for inglês, em todos os módulos, sem traduzir dados cadastrados pelas empresas nem valores técnicos persistidos no banco.

## Implementação
1. Corrigir imediatamente os resíduos confirmados na tela de Denúncias, incluindo “Relatórios”, “Novas”, “Sendo investigadas” e “Resolvidas”.
2. Migrar strings hardcoded restantes em páginas, componentes compartilhados, onboarding, paleta de comandos, confirmações e indicadores para o sistema `t()` existente.
3. Tornar descrições de frameworks, rótulos de maturidade e fallbacks dependentes do idioma atual.
4. Auditar separadamente Core/Configurações, módulos GRC e módulos especializados (Gap Analysis, DocGen, Due Diligence e Denúncias), corrigindo somente textos de interface.
5. Preservar nomes e conteúdo criados pelo usuário/empresa, valores de enum usados no banco, logs, comentários e identificadores técnicos.

## Validação
- Executar verificação TypeScript e teste de paridade PT/EN.
- Repetir busca estática por strings portuguesas visíveis fora dos dicionários.
- Navegar pelo app em inglês e conferir as telas principais, incluindo Canal de Denúncias.
