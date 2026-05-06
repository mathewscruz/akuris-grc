## Diagnóstico

Os tons de texto secundários e divisórias da landing page estão **frios demais e com baixo contraste** sobre o navy `#0a1628`:

| Token | Atual | Contraste | Problema |
|---|---|---|---|
| `--lp-text` (corpo) | `#e7e5e0` (bege-cinza) | bom | Tom levemente "amarelado", destoa do resto do app |
| `--lp-text-2` (parágrafos secundários) | `#a9a8a3` | ~6:1 | Aceitável, mas opaco |
| `--lp-text-3` (labels, datas, índices M.01) | `#71706c` | ~3.4:1 | **Abaixo de WCAG AA p/ texto pequeno** |
| `--lp-text-4` (decorativo) | `#4b4a48` | ~2:1 | Praticamente invisível |
| `--lp-line` (divisórias) | `#1e2d45` | muito fraco | Grid editorial perde definição |
| `--lp-line-2` | `#2a3a5a` | fraco | Cards e botões ghost somem |

Como a marca é fria (Navy + Purple), os neutros bege/quente brigam visualmente. A correção é trocar os neutros por uma escala fria neutra, **subir contraste** dos níveis 2/3 e reforçar as linhas.

## Mudanças (somente `src/index.css`, bloco `.lp-root`)

```css
--lp-text:    #f5f7fa;   /* era #e7e5e0  — branco levemente frio */
--lp-text-2:  #c7cdd6;   /* era #a9a8a3  — +contraste, neutro frio (~9:1) */
--lp-text-3:  #94a0b3;   /* era #71706c  — sobe p/ AA em 11–13px (~5:1) */
--lp-text-4:  #6b7890;   /* era #4b4a48  — visível como decorativo (~3:1) */
--lp-line:    #233149;   /* era #1e2d45  — divisórias mais nítidas */
--lp-line-2:  #34466a;   /* era #2a3a5a  — bordas de card/ghost legíveis */
--lp-accent-2:#cfc4ff;   /* era #b9b0fa  — leve ajuste p/ harmonia */
```

Adicionalmente:

- `.lp-btn-ghost` — borda passa de `--lp-line-2` (já reforçada) e hover de `--lp-text-3`. Sem mudança no seletor; os tokens novos cuidam.
- `.lp-faq summary` (ícone `+/−`) usa `--lp-text-3` → fica visível automaticamente.
- `.lp-module .idx` (M.01–M.08) ganha legibilidade real.

## Por que isso resolve

1. **WCAG AA** atendido em todos os textos pequenos (mono labels, datas, índices).
2. **Coerência cromática** — toda a paleta passa a ser fria, alinhada ao Navy/Purple do Akuris (sem o bege quente que parecia "off-brand").
3. **Hierarquia visual preservada** — mantemos 4 níveis de cinza, só que mais separados em luminosidade.
4. **Divisórias** ganham presença sem virar "linha preta", preservando o estilo editorial.

Mudança cirúrgica, escopada em `.lp-root`. Nenhum componente do app é afetado.