# Mais simplificações sugeridas

Itens novos, sem repetir os que você já recusou. Escolha os que quer aplicar.

## Funcionalidade

1. **Separar a área "Administração Akuris" das Configurações do cliente**
   Hoje Configurações mistura o que o cliente usa (organização, usuários, integrações) com o que só a equipe Akuris usa (empresas, planos, créditos de IA, financeiro, blog, novidades, campanhas, contatos).
   Por quê: o administrador do cliente vê só o que é dele; a equipe Akuris tem um lugar próprio, mais fácil de manter.

2. **Permissões só por perfil**
   Hoje dá para dar permissão por perfil e também ajustar usuário a usuário, em telas diferentes.
   Proposta: cada usuário recebe um perfil; para um caso especial, cria-se um perfil novo. Ajustes individuais existentes são convertidos em perfis automaticamente.
   Por quê: fica claro quem pode o quê, e a revisão de acessos é feita olhando poucos perfis.

3. **Um único espaço de avisos no topo**
   Aviso de período de teste, aviso de crédito de IA usado e convite para instalar o app aparecem cada um no seu canto.
   Proposta: uma faixa única que mostra o aviso mais importante por vez; os demais vão para o sino.
   Por quê: menos interrupções e nada empilhado no topo da tela.

4. **Exportar sempre no mesmo lugar e do mesmo jeito**
   Cada módulo exporta de um jeito (botão solto, menu "…", opções diferentes).
   Proposta: um botão "Exportar" padrão em todas as listas, sempre com CSV e PDF dos itens filtrados.
   Por quê: o usuário aprende uma vez e acha em qualquer módulo.

## Visual

5. **Cores de módulo só no menu**
   Ícones e destaques coloridos por módulo aparecem em cartões, cabeçalhos e listas.
   Proposta: cor só para estado (bom, atenção, crítico) e para ação; o restante em tons neutros.
   Por quê: a cor volta a significar algo — quando aparece, o usuário sabe que precisa olhar.

6. **Espaçamentos em uma escala única**
   Distâncias entre blocos variam de módulo para módulo.
   Proposta: três medidas apenas (pequena, média, grande) aplicadas a todas as páginas.
   Por quê: o sistema parece um produto só, e telas novas já nascem alinhadas.

## Fora do escopo
- Sem mudanças no isolamento entre empresas ou nos dados existentes.
- Links antigos continuam funcionando.

## Detalhes técnicos
- 1: nova rota `/admin-akuris` restrita a super-admin, reaproveitando os componentes de gestão já existentes; Configurações fica só com os itens do cliente.
- 2: migration que gera um perfil por combinação de ajustes individuais e atribui aos usuários; remover a tela de permissão por usuário. Validar RLS e as funções de permissão.
- 3: componente de aviso único no `Layout` com prioridade (teste > crédito > instalar app); itens secundários viram notificações.
- 4: componente compartilhado de exportação usando `csv-utils` e `pdf-utils`, plugado no `DataTable`.
- 5–6: tokens em `index.css`/`tailwind.config.ts`; atualizar regra visual na memória.
- Rodar a suíte de testes ao final.
