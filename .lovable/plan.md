# Simplificações sugeridas para o Akuris

O sistema cresceu rápido e hoje há mais de um caminho para a mesma coisa. Abaixo, o que eu simplificaria, por ordem de impacto. Aprove tudo ou diga quais itens quer manter.

## Funcionalidade

1. **Uma só lista de pendências pessoais**
   Hoje existem "Minhas tarefas" (dentro de Projetos), "Planos de Ação" (que já junta pendências de controles, auditorias e incidentes) e itens no sino.
   Por quê: o usuário não sabe onde olhar primeiro. Proposta: "Minhas tarefas" vira uma aba filtrada "Atribuídas a mim" dentro de Planos de Ação; o link antigo continua funcionando.

2. **Retirar a janela antiga do requisito**
   A edição de requisitos já vive na página cheia, mas a tabela genérica de requisitos de alguns frameworks ainda abre a janela antiga de 4 etapas.
   Por quê: duas telas com regras de salvar diferentes já geraram o bug das respostas antigas. Proposta: essa tabela passa a abrir a página cheia; a janela antiga é removida.

3. **Uma só rota para Planos de Ação**
   Existem dois endereços (/planos e /planos-acao).
   Por quê: links compartilhados e atalhos divergem. Proposta: um endereço oficial, o outro redireciona.

4. **Canal de denúncia com menos telas públicas**
   Há landing, menu, formulário, consulta, roteador e redirecionamento externo separados.
   Por quê: o denunciante precisa de duas ações: denunciar ou consultar protocolo. Proposta: uma página com essas duas opções; links antigos redirecionam.

5. **Menos interruptores de preferência**
   Tema, densidade da tabela e modo foco ficam espalhados no topo.
   Por quê: poucos usam e ocupam espaço nobre. Proposta: tudo em um único menu "Aparência" no avatar.

## Visual

6. **Um só padrão de indicador por tipo de informação**
   Hoje convivem anel (estado), barras (gravidade), pílulas e minigráficos.
   Proposta: estado = anel, gravidade = barras, contagem = número puro; minigráfico só no cartão "Total" e só quando há variação real.

7. **Dashboard sem cartões que repetem módulos**
   Alguns cartões repetem a mesma métrica que a primeira linha de indicadores.
   Proposta: cada número aparece uma única vez; cartões duplicados saem.

8. **Cabeçalhos de módulo mais curtos**
   Ícone + grupo + título + descrição + faixa de indicadores + sub-barra empurram a tabela para baixo.
   Proposta: descrição só no primeiro acesso (ou em "?"), indicadores numa linha compacta.

## Fora do escopo
- Nenhuma mudança em regras de permissão, isolamento por empresa ou dados.
- Links antigos sempre redirecionam; nada quebra para quem salvou favoritos.

## Detalhes técnicos
- Item 1: `MinhasTarefas` passa a ser filtro `responsavel = usuário` em `PlanosAcao`; rota `/projetos/minhas-tarefas` redireciona.
- Item 2: `GenericRequirementsTable` navega para `/gap-analysis/framework/:id/requisito/:reqId`; remover `RequirementDetailDialog` e ajustar testes que o referenciam.
- Item 3: manter `/planos-acao`, `/planos` vira `<Navigate>`.
- Item 4: unificar `DenunciaMenu`/`DenunciaPublicLanding`/`DenunciaRouter` numa página; RPCs públicas inalteradas.
- Itens 6–8: ajustes em `chip.tsx`, `StatStrip`, `PageHeader` e tiles do dashboard; atualizar regra de linguagem visual na memória.
- Rodar a suíte de testes ao final.
