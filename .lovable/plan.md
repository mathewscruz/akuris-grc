# Submenu do menu lateral: painel escuro integrado

## Como vai ficar
Ao tocar ou clicar num módulo com subitens (ex.: Ativos), abre um painel **colado ao menu, na mesma cor escura dele**, como se fosse uma continuação da coluna:

```text
| [A]      |  GERENCIAMENTO DE ATIVOS          |
|          |  ─────────────────────────────    |
|▌ Ativos  |  ▌[ícone] Ativos                  |
|          |     Inventário e ficha técnica    |
| Contratos|    [ícone] Licenças               |
|          |     Validade e renovações         |
|          |    [ícone] Chaves                 |
|          |     Certificados e segredos       |
```

- **Topo:** nome do módulo em letras pequenas maiúsculas, com uma linha fina abaixo.
- **Cada opção:** ícone num quadradinho suave, nome e uma frase curta explicando o que tem ali.
- **Opção aberta:** fundo levemente destacado, barrinha roxa à esquerda e ícone roxo (mesmo padrão do menu).
- **Passar o mouse:** fundo suave; sem cores novas.
- **Entrada:** desliza alguns pixels da esquerda com fade rápido (respeita "reduzir movimento").
- **Borda** fina em vez de sombra, seguindo o padrão do tema escuro; no tema claro acompanha as cores do menu.
- Fecha ao escolher uma opção, clicar fora ou apertar Esc; navegação por teclado (setas).
- Celular continua com a lista que abre embaixo do item, ganhando só as frases curtas.

## Detalhes técnicos
- `AppSidebar.tsx`: estilizar o `PopoverContent` com `bg-sidebar`, `border-sidebar-border`, `side="right"`, `sideOffset` 0 alinhado à borda do rail, `dark:shadow-none`, animação `slide-in-from-left-2`.
- Descrições curtas: nova chave opcional `description` em `navigation.ts` (subitens) com textos PT/EN em `sidebar.desc.*`; sem descrição, mostra só o nome.
- Item ativo reutiliza `bg-sidebar-accent` + barra `bg-primary` do rail.
