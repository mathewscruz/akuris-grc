import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { loadAkurisLogo, addAkurisHeader, addAkurisFooter, AKURIS_COLORS } from '@/lib/pdf-utils';
import { intlLocale } from '@/lib/date-utils';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** PDF para o auditor: tarefas concluídas, evidências e requisito/controlo ligado. Só dados do projeto (já isolado por empresa). */
export async function gerarPacoteEvidencias(projeto: { id: string; nome: string; empresa_id?: string | null }, t: TFn, empresaNome?: string) {
  const { data: tarefas, error } = await supabase.from('projeto_tarefas' as any)
    .select('id, titulo, concluida_em, responsavel_id').eq('projeto_id', projeto.id).not('concluida_em', 'is', null).order('concluida_em');
  if (error) throw error;
  const ts = (tarefas ?? []) as any[];
  const ids = ts.map((x) => x.id);
  const anexos: any[] = []; const vinculos: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200);
    const [a, v] = await Promise.all([
      supabase.from('projeto_tarefa_anexos' as any).select('tarefa_id, nome, tipo_origem, url, uploaded_by, created_at').in('tarefa_id', parte),
      supabase.from('projeto_tarefa_vinculos' as any).select('tarefa_id, entidade_tipo, entidade_id').in('tarefa_id', parte).in('entidade_tipo', ['gap_requirement', 'controle']),
    ]);
    anexos.push(...((a.data as any[]) ?? [])); vinculos.push(...((v.data as any[]) ?? []));
  }
  const reqIds = vinculos.filter((v) => v.entidade_tipo === 'gap_requirement').map((v) => v.entidade_id);
  const ctlIds = vinculos.filter((v) => v.entidade_tipo === 'controle').map((v) => v.entidade_id);
  const userIds = Array.from(new Set([...ts.map((x) => x.responsavel_id), ...anexos.map((a) => a.uploaded_by)].filter(Boolean)));
  const [reqs, ctls, users] = await Promise.all([
    reqIds.length ? supabase.from('gap_analysis_requirements').select('id, codigo, titulo').in('id', reqIds) : Promise.resolve({ data: [] }),
    ctlIds.length && projeto.empresa_id ? supabase.from('controles').select('id, codigo, nome').eq('empresa_id', projeto.empresa_id).in('id', ctlIds) : Promise.resolve({ data: [] }),
    userIds.length && projeto.empresa_id ? supabase.from('profiles').select('user_id, nome').eq('empresa_id', projeto.empresa_id).in('user_id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const nomeAlvo: Record<string, string> = {};
  ((reqs as any).data ?? []).forEach((r: any) => { nomeAlvo[r.id] = [r.codigo, r.titulo].filter(Boolean).join(' '); });
  ((ctls as any).data ?? []).forEach((r: any) => { nomeAlvo[r.id] = [r.codigo, r.nome].filter(Boolean).join(' '); });
  const nomeUser: Record<string, string> = {};
  ((users as any).data ?? []).forEach((u: any) => { nomeUser[u.user_id] = u.nome; });
  const data = (s: string) => new Date(s).toLocaleDateString(intlLocale());

  const doc = new jsPDF();
  const logo = await loadAkurisLogo();
  let y = addAkurisHeader(doc, logo);
  doc.setFontSize(15); doc.setTextColor(AKURIS_COLORS.text ?? '#111'); doc.text(t('evidSemana.pacoteTitulo'), 14, y + 6);
  doc.setFontSize(10); doc.setTextColor('#666');
  const semEv = ts.filter((x) => !anexos.some((a) => a.tarefa_id === x.id)).length;
  doc.text(`${projeto.nome} · ${t('evidSemana.pacoteResumo', { n: ts.length, e: anexos.length, s: semEv })}`, 14, y + 13);
  y += 20;

  const linhas: string[][] = [];
  ts.forEach((x) => {
    const evs = anexos.filter((a) => a.tarefa_id === x.id);
    const alvos = vinculos.filter((v) => v.tarefa_id === x.id).map((v) => nomeAlvo[v.entidade_id]).filter(Boolean).join('\n') || '—';
    const base = [x.titulo, data(x.concluida_em), nomeUser[x.responsavel_id] ?? '—', alvos];
    if (!evs.length) linhas.push([...base, t('evidSemana.semEvidencia')]);
    else evs.forEach((ev, i) => linhas.push([
      ...(i === 0 ? base : ['', '', '', '']),
      `${ev.nome}${ev.tipo_origem === 'link' && ev.url ? `\n${ev.url}` : ''}\n${nomeUser[ev.uploaded_by] ?? ''} · ${data(ev.created_at)}`,
    ]));
  });
  autoTable(doc, {
    startY: y,
    head: [[t('evidSemana.pdfTarefa'), t('evidSemana.pdfConcluida'), t('evidSemana.pdfResponsavel'), t('evidSemana.pdfRequisito'), t('evidSemana.aba')]],
    body: linhas,
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: AKURIS_COLORS.primary as any },
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 20 }, 2: { cellWidth: 26 }, 3: { cellWidth: 40 } },
    margin: { left: 14, right: 14, bottom: 22 },
  });
  addAkurisFooter(doc, empresaNome);
  const slug = projeto.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  doc.save(`${slug}-evidencias.pdf`);
}
