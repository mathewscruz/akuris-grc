# Sistema vinculado e criticidade nos planos de continuidade

## O que o usuário vai ver

1. **Novo campo "Sistema" no formulário do plano de continuidade**
   - Lista para escolher entre os sistemas já cadastrados no Akuris (Contas Privilegiadas → Sistemas), com busca por nome.
   - Mostra apenas os sistemas da própria empresa. Campo opcional.

2. **Novo campo "Criticidade"**
   - Opções: Baixa, Média, Alta, Crítica (padrão: Média), com o mesmo estilo de pílula usado no resto do sistema.

3. **Na lista de planos**
   - Novas colunas "Sistema" (nome) e "Criticidade", com filtro por criticidade e inclusão na exportação CSV/PDF.
   - O painel lateral do plano também mostra o sistema e a criticidade.

Textos em pt e en.

## Detalhes técnicos

- Migração em `continuidade_planos`: `sistema_id uuid null references sistemas_privilegiados(id) on delete set null` e `criticidade text not null default 'media'` com gatilho de validação (baixa/media/alta/critica). As políticas por empresa existentes continuam valendo; o gatilho também confirma que o sistema pertence à mesma `empresa_id` do plano.
- `PlanoDialog.tsx`: select de sistemas (`.eq('empresa_id', empresaId)`) e select de criticidade.
- `Continuidade.tsx`: colunas, filtro e exportação; tom da criticidade via `status-tone`.
- Teste curto para o mapeamento de criticidade em tom/rótulo.
