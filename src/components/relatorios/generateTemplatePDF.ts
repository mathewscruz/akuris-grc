import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { loadAkurisLogo, addAkurisCover, addAkurisFooter, addSectionTitle as addPdfSectionTitle, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';

// ── helpers ──────────────────────────────────────────────────────────
function addSectionTitleLocal(doc: jsPDF, title: string, y: number): number {
  return addPdfSectionTitle(doc, title, y, 20);
}

function addMetricRow(doc: jsPDF, label: string, value: string | number, y: number): number {
  doc.setFontSize(11);
  doc.setTextColor(AKURIS_COLORS.textLight);
  doc.text(label, 28, y);
  doc.setTextColor(AKURIS_COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value), 120, y);
  doc.setFont('helvetica', 'normal');
  return y + 7;
}

function checkPageBreak(doc: jsPDF, y: number, margin = 40): number {
  if (y > 260 - margin) {
    doc.addPage();
    return 25;
  }
  return y;
}

function addTable(doc: jsPDF, headers: string[], rows: string[][], startY: number, colWidths: number[]): number {
  let y = startY;
  
  // Header
  doc.setFontSize(8);
  doc.setFillColor(AKURIS_COLORS.primary);
  let x = 20;
  headers.forEach((h, i) => {
    doc.rect(x, y - 5, colWidths[i], 8, 'F');
    x += colWidths[i];
  });
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  x = 20;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y);
    x += colWidths[i];
  });
  y += 6;
  
  doc.setFont('helvetica', 'normal');
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    y = checkPageBreak(doc, y);
    
    // Zebra striping
    if (ri % 2 === 0) {
      doc.setFillColor(248, 247, 255);
      x = 20;
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      doc.rect(20, y - 3.5, totalW, 6, 'F');
    }
    
    doc.setFontSize(8);
    doc.setTextColor(AKURIS_COLORS.text);
    x = 20;
    row.forEach((cell, i) => {
      const formatted = formatLabel(cell || '-');
      const lines = doc.splitTextToSize(formatted, colWidths[i] - 4);
      doc.text(lines[0], x + 2, y);
      x += colWidths[i];
    });
    y += 6;
  }
  return y + 5;
}

// ── data fetchers ────────────────────────────────────────────────────
export async function fetchTemplateData(templateBase: string, empresaId: string) {
  switch (templateBase) {
    case 'riscos_geral': return fetchRiscosData(empresaId);
    case 'incidentes_periodo': return fetchIncidentesData(empresaId);
    case 'lgpd_anpd': return fetchLGPDData(empresaId);
    case 'iso27001_auditoria': return fetchISO27001Data(empresaId);
    case 'executivo_trimestral': return fetchExecutivoData(empresaId);
    case 'compliance_geral': return fetchComplianceData(empresaId);
    case 'continuidade_bcp': return fetchContinuidadeData(empresaId);
    case 'contratos_geral': return fetchContratosData(empresaId);
    case 'ativos_inventario': return fetchAtivosData(empresaId);
    case 'auditoria_interna': return fetchAuditoriaInternaData(empresaId);
    case 'due_diligence_fornecedores': return fetchDueDiligenceData(empresaId);
    case 'documentos_governanca': return fetchDocumentosData(empresaId);
    case 'denuncias_canal_etica': return fetchDenunciasData(empresaId);
    default: return { sections: [] as Section[] };
  }
}

interface Section { title: string; metrics?: { label: string; value: string | number }[]; tableHeaders?: string[]; tableRows?: string[][]; colWidths?: number[]; }

async function fetchRiscosData(empresaId: string) {
  const { data: riscos } = await supabase.from('riscos').select('*').eq('empresa_id', empresaId);
  const r = riscos || [];
  const riscoIds = r.map(ri => ri.id);
  const { data: tratamentos } = riscoIds.length > 0
    ? await supabase.from('riscos_tratamentos').select('*').in('risco_id', riscoIds)
    : { data: [] };
  const t = tratamentos || [];
  // Normaliza (sem acento/minúsculo) porque os dados misturam "Médio" e "medio" etc.
  const nivel = (x: any) => (x.nivel_risco_inicial || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const criticos = r.filter(x => nivel(x) === 'critico').length;
  const altos = r.filter(x => nivel(x) === 'alto').length;
  const medios = r.filter(x => nivel(x) === 'medio').length;
  const baixos = r.filter(x => nivel(x) === 'baixo').length;
  const concluidos = t.filter((x: any) => x.status === 'concluido').length;
  // Resolve responsáveis gravados como UUID -> nome (dados legados têm ambos)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const respIds = [...new Set(r.map(x => x.responsavel).filter((v: any) => v && uuidRe.test(v)))] as string[];
  let respMap: Record<string, string> = {};
  if (respIds.length) {
    const { data: profs } = await supabase.from('profiles').select('user_id, nome').in('user_id', respIds);
    respMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.nome]));
  }
  const respLabel = (v: any) => (v ? (respMap[v] || v) : '-');
  return {
    sections: [
      { title: 'Resumo Executivo', metrics: [
        { label: 'Total de Riscos', value: r.length },
        { label: 'Criticos', value: criticos },
        { label: 'Altos', value: altos },
        { label: 'Medios', value: medios },
        { label: 'Baixos', value: baixos },
        { label: 'Tratamentos Concluidos', value: `${concluidos}/${t.length}` },
      ]},
      { title: 'Detalhamento dos Riscos', tableHeaders: ['Nome', 'Nivel', 'Status', 'Responsavel'],
        tableRows: r.map(x => [x.nome, x.nivel_risco_inicial || '-', x.status || '-', respLabel(x.responsavel)]),
        colWidths: [60, 30, 35, 45] },
    ] as Section[]
  };
}

async function fetchIncidentesData(empresaId: string) {
  const { data: inc } = await supabase.from('incidentes').select('*').eq('empresa_id', empresaId).order('data_deteccao', { ascending: false });
  const i = inc || [];
  const critica = i.filter(x => x.criticidade === 'critica').length;
  const alta = i.filter(x => x.criticidade === 'alta').length;
  const resolvidos = i.filter(x => x.status === 'resolvido').length;
  return {
    sections: [
      { title: 'Resumo de Incidentes', metrics: [
        { label: 'Total de Incidentes', value: i.length },
        { label: 'Gravidade Critica', value: critica },
        { label: 'Gravidade Alta', value: alta },
        { label: 'Resolvidos', value: resolvidos },
      ]},
      { title: 'Lista de Incidentes', tableHeaders: ['Titulo', 'Categoria', 'Criticidade', 'Status'],
        tableRows: i.map(x => [x.titulo, x.categoria || '-', x.criticidade || '-', x.status || '-']),
        colWidths: [60, 35, 35, 40] },
    ] as Section[]
  };
}

async function fetchLGPDData(empresaId: string) {
  const [{ data: dados }, { data: sol }] = await Promise.all([
    supabase.from('dados_pessoais').select('*').eq('empresa_id', empresaId),
    supabase.from('dados_solicitacoes_titular').select('*').eq('empresa_id', empresaId),
  ]);
  const d = dados || []; const s = sol || [];
  return {
    sections: [
      { title: 'Panorama LGPD', metrics: [
        { label: 'Dados Pessoais Mapeados', value: d.length },
        { label: 'Solicitacoes de Titulares', value: s.length },
      ]},
      { title: 'Dados Pessoais Mapeados', tableHeaders: ['Nome', 'Categoria', 'Base Legal', 'Sensibilidade'],
        tableRows: d.map(x => [x.nome, x.categoria_dados || '-', x.base_legal || '-', x.sensibilidade || '-']),
        colWidths: [50, 35, 45, 40] },
      ...(s.length > 0 ? [{ title: 'Solicitacoes de Titulares', tableHeaders: ['Tipo', 'Status', 'Criado em'],
        tableRows: s.map((x: any) => [x.tipo_solicitacao || '-', x.status || '-', new Date(x.created_at).toLocaleDateString('pt-BR')]),
        colWidths: [60, 50, 60] }] : []),
    ] as Section[]
  };
}

async function fetchISO27001Data(empresaId: string) {
  // Frameworks are global (empresa_id IS NULL), evaluations are per-company
  const { data: frameworks } = await (supabase.from('gap_analysis_frameworks').select('id, nome, versao, tipo_framework').ilike('nome', '%ISO%27001%') as any);
  const { data: evaluations } = await supabase.from('gap_analysis_evaluations').select('framework_id, conformity_status').eq('empresa_id', empresaId);
  const { data: controles } = await supabase.from('controles').select('*').eq('empresa_id', empresaId);
  const f = (frameworks || []) as any[]; const e = evaluations || []; const c = controles || [];
  const ativos = c.filter(x => x.status === 'ativo').length;
  
  // Calculate conformity stats from evaluations
  const isoFrameworkIds = f.map(fw => fw.id);
  const isoEvals = e.filter(ev => isoFrameworkIds.includes(ev.framework_id));
  const conformes = isoEvals.filter(ev => ev.conformity_status === 'conforme').length;
  const parciais = isoEvals.filter(ev => ev.conformity_status === 'parcialmente_conforme').length;
  const naoConformes = isoEvals.filter(ev => ev.conformity_status === 'nao_conforme').length;
  
  return {
    sections: [
      { title: 'Status ISO 27001', metrics: [
        { label: 'Frameworks ISO encontrados', value: f.length },
        { label: 'Requisitos avaliados', value: isoEvals.length },
        { label: 'Conformes', value: conformes },
        { label: 'Parcialmente conformes', value: parciais },
        { label: 'Nao conformes', value: naoConformes },
        { label: 'Total de Controles', value: c.length },
        { label: 'Controles Ativos', value: ativos },
      ]},
      { title: 'Controles Implementados', tableHeaders: ['Nome', 'Tipo', 'Criticidade', 'Status'],
        tableRows: c.map(x => [x.nome, x.tipo || '-', x.criticidade || '-', x.status || '-']),
        colWidths: [55, 30, 40, 45] },
    ] as Section[]
  };
}

async function fetchExecutivoData(empresaId: string) {
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { data: riscos } = await supabase.from('riscos').select('*').eq('empresa_id', empresaId);
  const { data: incidentes } = await (supabase.from('incidentes').select('*').eq('empresa_id', empresaId).gte('data_deteccao', ninetyDaysAgo.toISOString()) as any);
  const { data: controles } = await supabase.from('controles').select('*').eq('empresa_id', empresaId);
  const frameworksResult = await (supabase as any).from('gap_analysis_frameworks').select('id, nome').eq('ativo', true);
  const frameworks = frameworksResult?.data || [];
  const r = riscos || []; const i = incidentes || []; const c = controles || []; const f = frameworks || [];
  return {
    sections: [
      { title: 'Resumo Executivo - Ultimos 90 dias', metrics: [
        { label: 'Riscos Ativos', value: r.length },
        { label: 'Riscos Criticos', value: r.filter(x => x.nivel_risco_inicial === 'critico').length },
        { label: 'Incidentes (90 dias)', value: i.length },
        { label: 'Controles Ativos', value: c.filter(x => x.status === 'ativo').length },
        { label: 'Frameworks Monitorados', value: f.length },
      ]},
      { title: 'Incidentes Recentes', tableHeaders: ['Titulo', 'Gravidade', 'Status'],
        tableRows: i.slice(0, 15).map(x => [x.titulo, x.criticidade || '-', x.status || '-']),
        colWidths: [80, 45, 45] },
    ] as Section[]
  };
}

async function fetchComplianceData(empresaId: string) {
  const fwResult = await (supabase as any).from('gap_analysis_frameworks').select('id, nome, versao, tipo_framework').eq('ativo', true);
  const frameworks = fwResult?.data || [];
  const { data: controles } = await supabase.from('controles').select('*').eq('empresa_id', empresaId);
  const { data: auditorias } = await supabase.from('auditorias').select('*').eq('empresa_id', empresaId);
  const f = (frameworks || []) as any[]; const c = controles || []; const a = auditorias || [];
  return {
    sections: [
      { title: 'Status Geral de Compliance', metrics: [
        { label: 'Frameworks', value: f.length },
        { label: 'Controles', value: c.length },
        { label: 'Controles Ativos', value: c.filter(x => x.status === 'ativo').length },
        { label: 'Auditorias', value: a.length },
      ]},
      { title: 'Frameworks', tableHeaders: ['Nome', 'Versao', 'Tipo'],
        tableRows: f.map(x => [x.nome, x.versao || '-', x.tipo_framework || '-']),
        colWidths: [80, 40, 50] },
      { title: 'Auditorias', tableHeaders: ['Nome', 'Tipo', 'Status'],
        tableRows: a.map((x: any) => [x.nome || x.titulo || '-', x.tipo || '-', x.status || '-']),
        colWidths: [80, 40, 50] },
    ] as Section[]
  };
}

async function fetchContinuidadeData(empresaId: string) {
  const [{ data: planos }, { data: tarefas }, { data: testes }] = await Promise.all([
    supabase.from('continuidade_planos').select('*').eq('empresa_id', empresaId),
    supabase.from('continuidade_tarefas').select('*').eq('empresa_id', empresaId),
    supabase.from('continuidade_testes').select('*').eq('empresa_id', empresaId),
  ]);
  const p = planos || []; const t = tarefas || []; const te = testes || [];
  const hoje = new Date();
  const planosVencendo = p.filter((x: any) => x.proxima_revisao && new Date(x.proxima_revisao) < new Date(hoje.getTime() + 30 * 86400000)).length;
  const tarefasPendentes = t.filter((x: any) => x.status !== 'concluida').length;
  const testesSucesso = te.filter((x: any) => x.resultado === 'sucesso').length;
  return {
    sections: [
      { title: 'Resumo de Continuidade de Negocios', metrics: [
        { label: 'Total de Planos', value: p.length },
        { label: 'Planos Ativos', value: p.filter((x: any) => x.status === 'ativo').length },
        { label: 'Em Revisao', value: p.filter((x: any) => x.status === 'em_revisao').length },
        { label: 'Revisao Vencendo (30d)', value: planosVencendo },
        { label: 'Total de Tarefas', value: t.length },
        { label: 'Tarefas Pendentes', value: tarefasPendentes },
        { label: 'Testes Realizados', value: te.length },
        { label: 'Testes com Sucesso', value: testesSucesso },
      ]},
      { title: 'Planos de Continuidade', tableHeaders: ['Nome', 'Tipo', 'Status', 'RTO/RPO'],
        tableRows: p.map((x: any) => [x.nome, x.tipo || '-', x.status || '-', `${x.rto_horas || '-'}h / ${x.rpo_horas || '-'}h`]),
        colWidths: [70, 30, 35, 35] },
      ...(te.length > 0 ? [{ title: 'Historico de Testes', tableHeaders: ['Tipo', 'Data', 'Resultado'],
        tableRows: te.map((x: any) => [x.tipo_teste || '-', x.data_teste ? new Date(x.data_teste).toLocaleDateString('pt-BR') : '-', x.resultado || '-']),
        colWidths: [60, 50, 60] }] : []),
    ] as Section[]
  };
}

async function fetchContratosData(empresaId: string) {
  const { data: contratos } = await supabase.from('contratos').select('*').eq('empresa_id', empresaId);
  const c = contratos || [];
  const hoje = new Date();
  const ativos = c.filter((x: any) => x.status === 'ativo').length;
  const vencendo = c.filter((x: any) => x.data_fim && new Date(x.data_fim) > hoje && new Date(x.data_fim) < new Date(hoje.getTime() + 90 * 86400000)).length;
  const vencidos = c.filter((x: any) => x.data_fim && new Date(x.data_fim) < hoje).length;
  const valorTotal = c.reduce((sum: number, x: any) => sum + (Number(x.valor) || 0), 0);
  return {
    sections: [
      { title: 'Resumo de Contratos', metrics: [
        { label: 'Total de Contratos', value: c.length },
        { label: 'Contratos Ativos', value: ativos },
        { label: 'Vencendo (90 dias)', value: vencendo },
        { label: 'Vencidos', value: vencidos },
        { label: 'Valor Total (BRL)', value: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
      ]},
      { title: 'Lista de Contratos', tableHeaders: ['Nome', 'Tipo', 'Status', 'Vencimento'],
        tableRows: c.map((x: any) => [x.nome || x.numero_contrato || '-', x.tipo || '-', x.status || '-', x.data_fim ? new Date(x.data_fim).toLocaleDateString('pt-BR') : '-']),
        colWidths: [70, 30, 35, 35] },
    ] as Section[]
  };
}

async function fetchAtivosData(empresaId: string) {
  const [{ data: ativos }, { data: licencas }, { data: chaves }] = await Promise.all([
    supabase.from('ativos').select('*').eq('empresa_id', empresaId),
    supabase.from('ativos_licencas').select('*').eq('empresa_id', empresaId),
    supabase.from('ativos_chaves_criptograficas').select('*').eq('empresa_id', empresaId),
  ]);
  const a = ativos || []; const l = licencas || []; const k = chaves || [];
  const tipos: Record<string, number> = {};
  a.forEach((x: any) => { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
  const criticos = a.filter((x: any) => x.criticidade === 'critica' || x.criticidade === 'alta').length;
  const hoje = new Date();
  const licencasVencendo = l.filter((x: any) => x.data_vencimento && new Date(x.data_vencimento) > hoje && new Date(x.data_vencimento) < new Date(hoje.getTime() + 90 * 86400000)).length;
  return {
    sections: [
      { title: 'Inventario de Ativos', metrics: [
        { label: 'Total de Ativos', value: a.length },
        { label: 'Ativos Criticos', value: criticos },
        { label: 'Licencas Cadastradas', value: l.length },
        { label: 'Licencas Vencendo (90d)', value: licencasVencendo },
        { label: 'Chaves Criptograficas', value: k.length },
      ]},
      { title: 'Distribuicao por Tipo', tableHeaders: ['Tipo', 'Quantidade'],
        tableRows: Object.entries(tipos).map(([t, q]) => [t, String(q)]),
        colWidths: [120, 50] },
      { title: 'Lista de Ativos', tableHeaders: ['Nome', 'Tipo', 'Criticidade', 'Status'],
        tableRows: a.map((x: any) => [x.nome, x.tipo || '-', x.criticidade || '-', x.status || '-']),
        colWidths: [60, 35, 35, 40] },
    ] as Section[]
  };
}

async function fetchAuditoriaInternaData(empresaId: string) {
  const { data: auditorias } = await supabase.from('auditorias').select('*').eq('empresa_id', empresaId);
  const a = auditorias || [];
  const auditoriaIds = a.map((x: any) => x.id);
  const { data: itens } = auditoriaIds.length > 0
    ? await supabase.from('auditoria_itens').select('*').in('auditoria_id', auditoriaIds)
    : { data: [] };
  const i = itens || [];
  const concluidas = a.filter((x: any) => x.status === 'concluida').length;
  const emAndamento = a.filter((x: any) => x.status === 'em_andamento').length;
  const itensAbertos = i.filter((x: any) => x.status !== 'concluido').length;
  return {
    sections: [
      { title: 'Resumo de Auditorias', metrics: [
        { label: 'Total de Auditorias', value: a.length },
        { label: 'Em Andamento', value: emAndamento },
        { label: 'Concluidas', value: concluidas },
        { label: 'Itens Identificados', value: i.length },
        { label: 'Itens em Aberto', value: itensAbertos },
      ]},
      { title: 'Auditorias', tableHeaders: ['Nome', 'Tipo', 'Status', 'Inicio'],
        tableRows: a.map((x: any) => [x.nome, x.tipo || '-', x.status || '-', x.data_inicio ? new Date(x.data_inicio).toLocaleDateString('pt-BR') : '-']),
        colWidths: [70, 30, 35, 35] },
      ...(i.length > 0 ? [{ title: 'Itens de Auditoria', tableHeaders: ['Codigo', 'Titulo', 'Prioridade', 'Status'],
        tableRows: i.slice(0, 30).map((x: any) => [x.codigo || '-', (x.titulo || '').substring(0, 40), x.prioridade || '-', x.status || '-']),
        colWidths: [25, 80, 30, 35] }] : []),
    ] as Section[]
  };
}

async function fetchDueDiligenceData(empresaId: string) {
  const { data: assessments } = await supabase.from('due_diligence_assessments').select('*').eq('empresa_id', empresaId);
  const dd = assessments || [];
  const concluidos = dd.filter((x: any) => x.status === 'concluido');
  const pendentes = dd.filter((x: any) => x.status !== 'concluido' && x.status !== 'cancelado').length;
  const scores = concluidos.map((x: any) => Number(x.score_final) || 0);
  const scoreMedio = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '0';
  const aprovados = concluidos.filter((x: any) => (Number(x.score_final) || 0) >= 7).length;
  return {
    sections: [
      { title: 'Due Diligence de Fornecedores', metrics: [
        { label: 'Total de Assessments', value: dd.length },
        { label: 'Concluidos', value: concluidos.length },
        { label: 'Pendentes', value: pendentes },
        { label: 'Score Medio (0-10)', value: scoreMedio },
        { label: 'Fornecedores Aprovados', value: aprovados },
      ]},
      { title: 'Assessments', tableHeaders: ['Fornecedor', 'Status', 'Score', 'Conclusao'],
        tableRows: dd.map((x: any) => [
          x.fornecedor_nome || '-',
          x.status || '-',
          x.score_final != null ? String(x.score_final) : '-',
          x.data_conclusao ? new Date(x.data_conclusao).toLocaleDateString('pt-BR') : '-'
        ]),
        colWidths: [70, 35, 25, 40] },
    ] as Section[]
  };
}

async function fetchDocumentosData(empresaId: string) {
  const { data: docs } = await supabase.from('documentos').select('*').eq('empresa_id', empresaId);
  const d = docs || [];
  const hoje = new Date();
  const ativos = d.filter((x: any) => x.status === 'ativo').length;
  const aprovados = d.filter((x: any) => x.status === 'aprovado').length;
  const vencidos = d.filter((x: any) => x.data_vencimento && new Date(x.data_vencimento) < hoje).length;
  const vencendo = d.filter((x: any) => x.data_vencimento && new Date(x.data_vencimento) >= hoje && new Date(x.data_vencimento) < new Date(hoje.getTime() + 30 * 86400000)).length;
  const tipos: Record<string, number> = {};
  d.forEach((x: any) => { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
  return {
    sections: [
      { title: 'Governanca Documental', metrics: [
        { label: 'Total de Documentos', value: d.length },
        { label: 'Ativos', value: ativos },
        { label: 'Aprovados', value: aprovados },
        { label: 'Vencidos', value: vencidos },
        { label: 'Vencendo (30d)', value: vencendo },
      ]},
      { title: 'Distribuicao por Tipo', tableHeaders: ['Tipo', 'Quantidade'],
        tableRows: Object.entries(tipos).map(([t, q]) => [t, String(q)]),
        colWidths: [120, 50] },
      { title: 'Documentos', tableHeaders: ['Nome', 'Tipo', 'Status', 'Vencimento'],
        tableRows: d.slice(0, 50).map((x: any) => [(x.nome || '').substring(0, 40), x.tipo || '-', x.status || '-', x.data_vencimento ? new Date(x.data_vencimento).toLocaleDateString('pt-BR') : '-']),
        colWidths: [70, 30, 35, 35] },
    ] as Section[]
  };
}

async function fetchDenunciasData(empresaId: string) {
  const { data: denuncias } = await supabase.from('denuncias').select('*').eq('empresa_id', empresaId);
  const d = denuncias || [];
  const abertas = d.filter((x: any) => x.status === 'aberta' || x.status === 'em_investigacao').length;
  const concluidas = d.filter((x: any) => x.status === 'concluida').length;
  const anonimas = d.filter((x: any) => x.anonima === true).length;
  const grav: Record<string, number> = {};
  d.forEach((x: any) => { grav[x.gravidade || 'sem_gravidade'] = (grav[x.gravidade || 'sem_gravidade'] || 0) + 1; });
  return {
    sections: [
      { title: 'Canal de Etica', metrics: [
        { label: 'Total de Denuncias', value: d.length },
        { label: 'Em Aberto/Investigacao', value: abertas },
        { label: 'Concluidas', value: concluidas },
        { label: 'Anonimas', value: anonimas },
      ]},
      { title: 'Distribuicao por Gravidade', tableHeaders: ['Gravidade', 'Quantidade'],
        tableRows: Object.entries(grav).map(([g, q]) => [g, String(q)]),
        colWidths: [120, 50] },
      { title: 'Denuncias', tableHeaders: ['Protocolo', 'Titulo', 'Gravidade', 'Status'],
        tableRows: d.map((x: any) => [x.protocolo || '-', (x.titulo || '').substring(0, 40), x.gravidade || '-', x.status || '-']),
        colWidths: [40, 70, 30, 35] },
    ] as Section[]
  };
}

// ── PDF generator ────────────────────────────────────────────────────
export async function generateTemplatePDF(relatorio: any, empresaId: string) {
  const doc = new jsPDF();
  const templateBase = relatorio.template_base;
  const data = await fetchTemplateData(templateBase, empresaId);
  const logo = await loadAkurisLogo();

  // Cover
  addAkurisCover(doc, logo, relatorio.nome, relatorio.descricao || '', {
    data: new Date().toLocaleDateString('pt-BR')
  });

  // Sections
  for (const section of data.sections) {
    doc.addPage();
    let y = 25;
    y = addSectionTitleLocal(doc, section.title, y);

    if (section.metrics) {
      for (const m of section.metrics) {
        y = checkPageBreak(doc, y);
        y = addMetricRow(doc, m.label, m.value, y);
      }
      y += 5;
    }

    if (section.tableHeaders && section.tableRows && section.colWidths) {
      y = checkPageBreak(doc, y, 60);
      y = addTable(doc, section.tableHeaders, section.tableRows, y, section.colWidths);
    }
  }

  // If no data at all
  if (data.sections.length === 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(AKURIS_COLORS.textLight);
    doc.text('Nenhum dado encontrado para este template.', 105, 140, { align: 'center' });
    doc.text('Verifique se ha dados cadastrados nos modulos correspondentes.', 105, 155, { align: 'center' });
  }

  addAkurisFooter(doc);
  doc.save(`${relatorio.nome.replace(/\s+/g, '_')}.pdf`);
}
