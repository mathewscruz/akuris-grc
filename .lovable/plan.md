# Corrigir erro ao salvar matriz de risco

## Causa confirmada

Ao salvar, o formulário grava a configuração da matriz com um `upsert` que declara conflito na coluna `matriz_id`:

```
.upsert({ matriz_id, escala_probabilidade, escala_impacto, niveis_risco, metodo_calculo },
        { onConflict: 'matriz_id' })
```

Mas a tabela `riscos_matriz_configuracao` **não tem índice único em `matriz_id`** — os únicos objetos existentes são a chave primária em `id` e a FK para `riscos_matrizes`. Sem restrição única correspondente, o Postgres rejeita a operação (erro 42P10, "no unique or exclusion constraint matching the ON CONFLICT specification"), e o formulário exibe o toast de erro ao salvar. Isso afeta tanto a criação quanto a edição de matriz.

Verificação adicional: hoje não existe nenhum `matriz_id` duplicado na tabela, então a restrição única pode ser criada sem limpeza de dados.

## Correção

1. Migração de banco:
   - criar índice único em `public.riscos_matriz_configuracao (matriz_id)`, garantindo a relação 1:1 matriz ↔ configuração e habilitando o `upsert` usado pelo app.
2. Sem mudança de UI necessária: o código do formulário passa a funcionar como escrito.

## Validação

- Criar uma matriz nova pela tela "Configurar Matriz" e confirmar que a configuração é gravada e o toast de sucesso aparece.
- Editar uma matriz existente (inclusive uma legada sem configuração) e confirmar que a configuração é criada/atualizada.
- Conferir no banco que cada matriz tem exatamente uma linha de configuração.

## Detalhes técnicos

- Tabela: `public.riscos_matriz_configuracao`; nenhuma alteração de RLS ou de grants é necessária (as políticas atuais permanecem).
- A migração é idempotente (`CREATE UNIQUE INDEX IF NOT EXISTS`) e não altera dados existentes.
