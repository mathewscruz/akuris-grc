/**
 * Identificador legível de um controlo interno.
 *
 * O campo `codigo` é livre e fica quase sempre por preencher, deixando a coluna
 * Código inteira a "—". Um auditor referencia o controlo por código no papel de
 * trabalho, por isso a listagem tem de mostrar sempre algo estável: se não há
 * código próprio, deriva-se um do UUID (que nunca muda).
 *
 * Mesmo padrão de `shortRiskId` em `src/components/riscos/risk-utils.ts` — a
 * escolha do prefixo é o que difere.
 *
 * NOTA: isto é apresentação. A geração de um código real e sequencial
 * (CTRL-0001) continua por fazer e exige migration.
 */
export function shortControleId(uuid?: string | null, codigo?: string | null): string {
  if (codigo) return codigo;
  if (!uuid) return 'C-—';
  const tail = uuid.replace(/-/g, '').slice(-3).toUpperCase();
  return `C-${tail}`;
}
