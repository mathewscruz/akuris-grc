# Ajustes nos demais módulos

Revisão dos módulos fora de Projetos. Itens encontrados, agrupados pelo que o usuário vê:

## 1. Botões repetidos (simplificar)
- **Riscos**: exportar CSV/PDF aparece no topo da página e também no menu Exportar da tabela. Manter só o da tabela.
- **Contratos**: mesmo caso com o CSV. Manter só o da tabela, preservando o formato atual do arquivo.

## 2. Calendários inconsistentes (visual)
Trocar o calendário nativo do navegador pelo calendário padrão do Akuris (localizado PT/EN) em:
- Manutenção de ativos (4 datas), Chaves (3), Assistente de contratos (3)
- Revisão de acessos: revisão, utilizador do sistema e decisão (5)
- Centro de privacidade (4)

## 3. Seletor de cor cru (visual)
Categorias de riscos, categorias de denúncia e marca do canal de denúncia: substituir o seletor nativo pelas mesmas 8 amostras de cor usadas no popup de projeto (componente compartilhado).

## 4. Mensagens só em português
- Assistente de riscos: 4 avisos de validação (conclusão, justificação de reavaliação, validade do aceite).
- Troca de empresa: aviso de falha ao carregar.
Passam a existir em PT e EN.

## 5. Carregamento fora do padrão
- Placeholders cinzas ainda aparecem ao carregar alguns módulos: passam a mostrar só o AkurisPulse.
- Ícones girando na consulta pública de denúncia e na sincronização de diretório: trocados pelo AkurisPulse com botão desativado.

## 6. Popups que não respondem
Continuidade (plano, tarefa, teste): o botão Salvar fica desativado até a empresa carregar e mostra aviso se faltar, em vez de não fazer nada.

## Detalhes técnicos
- Exportações via `onExport` do DataTable (regra AGENTS.md).
- `DateField` existente; novo `ColorSwatchField` extraído do `ProjetoDialog`.
- Chaves novas em dicionários PT/EN com verificação contra chaves cruas.
- `skeleton.tsx` sem `bg-muted/30`; `ModuleLoadingSkeleton` renderiza um `AkurisPulse`.
- Fora do escopo: cores fixas em páginas de login/política (fundos de marca, revisar caso a caso depois).
