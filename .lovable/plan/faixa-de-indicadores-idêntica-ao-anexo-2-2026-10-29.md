# Faixa de indicadores idêntica ao anexo 2

## Visual (igual em todos os módulos)
- Painel sempre azul-marinho escuro, também no tema claro, com cantos bem arredondados, borda fina e brilho roxo no canto superior direito.
- Destaque à esquerda: rótulo em maiúsculas espaçadas, número muito grande em branco, legenda curta abaixo ("riscos ativos"), barra grossa e arredondada com cores vivas (vermelho, laranja, amarelo, verde) e legenda abaixo: bolinha + nome, e embaixo "valor (%)".
- Colunas à direita: rótulo em maiúsculas, número grande em roxo, linha de alerta roxa com ícone de relógio ("6 atrasados", "2 a vencer"), seguida de uma lista com bolinha colorida, nome e valor alinhado à direita.
- Divisores verticais finos que não encostam no topo nem na base. Sem microbarras e sem mini gráficos.
- No celular: o destaque fica em cima e as colunas aparecem em grade, com "ver mais".

## Colunas por assunto (dados reais de cada módulo)
As colunas passam a mostrar outros assuntos, e não mais a repetição da divisão do destaque:
- Riscos: Riscos ativos por severidade | Tratamento (atrasados, em andamento, planejados, concluídos) | Controles ligados (por estado) | Aceites (a vencer, válidos, vencidos).
- Incidentes: por severidade | Por estado | Tratamentos | Comunicações/prazos.
- Ativos: por criticidade | Por estado | Licenças | Chaves.
- Documentos: por estado | Vencimento | Aprovações | Cadastro.
- Controles: por estado | Avaliação (em dia, a vencer, vencidos) | Testes | Tipo (preventivo, detetivo, corretivo).
- Auditorias, Sistemas, Contratos, Continuidade, Planos de ação, Projetos, Minhas tarefas, Denúncias, Privacidade, Contas privilegiadas, Revisão de acessos, Aceite de riscos, Licenças, Chaves, Relatórios, Due diligence: mesma lógica, com 3 colunas de assuntos e listas a partir do que cada tela já carrega ou de contagens simples dessa empresa.
- Se um assunto não tiver dados, a coluna mostra "—" e a lista fica vazia. Nunca números inventados.

## Validação
- Testes da faixa: segmentos, percentuais e lista por coluna.
- Captura da faixa nos temas claro e escuro e no celular, comparada com o anexo 2.
- Não dá para validar as páginas reais com login, porque o projeto usa um Supabase externo.

## Detalhes técnicos
- `stat-strip.tsx`: novos tokens `--stat-band-bg/fg/muted/divider` no CSS global, aplicados sempre (sem depender de `.dark`). Novo campo opcional `list` nos itens das colunas (`{label, value, tone}`), com `alert` já existente. Sem `series` nem `progress` na renderização.
- As cores vivas da barra vêm de tokens dedicados à faixa (crítico, alto, médio, baixo/concluído), em HSL.
- Cada módulo monta as colunas com `useMemo` a partir das queries existentes. As contagens novas (ex.: tratamentos e aceites em Riscos) usam hooks pequenos com `.eq('empresa_id', empresaId)` e `count: 'exact', head: true`.
- Rótulos novos em PT/EN via `t()`.
