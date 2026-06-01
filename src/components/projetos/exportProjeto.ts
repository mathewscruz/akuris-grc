import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { PRIORIDADE_LABEL, STATUS_LABEL } from '@/types/projetos';

/** CSV com BOM UTF-8 para Excel pt-BR. */
export function exportTarefasCSV(projetoNome: string, tarefas: ProjetoTarefa[], colunas: ProjetoColuna[]) {
  const colName = (id: string | null) => colunas.find((c) => c.id === id)?.nome ?? '';
  const headers = ['ID', 'Título', 'Descrição', 'Coluna', 'Prioridade', 'Responsável', 'Prazo', 'Estimativa (h)', 'Gasto (h)', 'Status', 'Concluída em', 'Criada em'];
  const rows = tarefas.map((t: any) => [
    t.id, t.titulo, (t.descricao ?? '').replace(/\n/g, ' '),
    colName(t.coluna_id),
    PRIORIDADE_LABEL[t.prioridade] ?? t.prioridade,
    t.responsavel_id ?? '',
    t.prazo ?? '',
    t.estimativa_horas ?? '',
    t.tempo_gasto_horas ?? '',
    t.concluida_em ? 'Concluída' : 'Em aberto',
    t.concluida_em ?? '',
    t.created_at ?? '',
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(projetoNome)}-tarefas.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
