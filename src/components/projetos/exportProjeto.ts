import type { ProjetoTarefa, ProjetoColuna } from '@/types/projetos';
import { PRIORIDADE_LABEL } from '@/types/projetos';
import { getPrioridadeLabel } from './enum-labels';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** CSV com BOM UTF-8 para Excel pt-BR. */
export function exportTarefasCSV(projetoNome: string, tarefas: ProjetoTarefa[], colunas: ProjetoColuna[], t?: TFn) {
  const colName = (id: string | null) => colunas.find((c) => c.id === id)?.nome ?? '';
  const prioridadeLabel = (p: ProjetoTarefa['prioridade']) => (t ? getPrioridadeLabel(t, p) : (PRIORIDADE_LABEL[p] ?? p));
  const doneLabel = t ? t('projetos.lista.done') : 'Concluída';
  const openLabel = t ? t('projetos.lista.open') : 'Em aberto';
  const headers = ['ID', 'Título', 'Descrição', 'Coluna', 'Prioridade', 'Responsável', 'Prazo', 'Estimativa (h)', 'Gasto (h)', 'Status', 'Concluída em', 'Criada em'];
  const rows = tarefas.map((tr: any) => [
    tr.id, tr.titulo, (tr.descricao ?? '').replace(/\n/g, ' '),
    colName(tr.coluna_id),
    prioridadeLabel(tr.prioridade),
    tr.responsavel_id ?? '',
    tr.prazo ?? '',
    tr.estimativa_horas ?? '',
    tr.tempo_gasto_horas ?? '',
    tr.concluida_em ? doneLabel : openLabel,
    tr.concluida_em ?? '',
    tr.created_at ?? '',
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
