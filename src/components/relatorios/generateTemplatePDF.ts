import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { loadAkurisLogo, addAkurisCover, addAkurisFooter, addSectionTitle as addPdfSectionTitle, drawTableHeader, formatLabel, AKURIS_COLORS } from '@/lib/pdf-utils';
import { getAppLocale } from '@/lib/i18n-locale';
import { contarRiscosPorSeveridade, severidadeRisco } from '@/lib/metrics';
import { contarDocumentos } from '@/lib/metrics/documentos';
import { intlLocale, parseDataLocal } from '@/lib/date-utils';

import { severidadeDeFaixas } from '@/lib/metrics/riscos';
import { somaPorMoeda } from '@/lib/metrics/contratos';
import { formatMoedasSomadas, getMoedaAtual } from '@/hooks/useEmpresaMoeda';
const PDF_LABELS: Record<string, string> = {
  "Altos": "High",
  "Anonimas": "Anonymous",
  "Aprovados": "Approved",
  "Assessments": "Assessments",
  "Ativos": "Active",
  "Ativos de Criticidade Alta ou Critica": "High or Critical Assets",
  "Auditorias": "Audits",
  "Baixos": "Low",
  "Canal de Etica": "Ethics Channel",
  "Chaves Criptograficas": "Cryptographic Keys",
  "Concluidas": "Completed",
  "Concluidos": "Completed",
  "Conformes": "Compliant",
  "Contratos Ativos": "Active Contracts",
  "Controles": "Controls",
  "Controles Ativos": "Active Controls",
  "Controles Implementados": "Implemented Controls",
  "Criticos": "Critical",
  "Dados Pessoais Mapeados": "Mapped Personal Data",
  "Denuncias": "Reports",
  "Detalhamento dos Riscos": "Risk Details",
  "Distribuicao por Gravidade": "Distribution by Severity",
  "Distribuicao por Tipo": "Distribution by Type",
  "Documentos": "Documents",
  "Due Diligence de Fornecedores": "Supplier Due Diligence",
  "Em Aberto/Investigacao": "Open/Under Investigation",
  "Em Andamento": "In Progress",
  "Em Revisao": "Under Review",
  "Fornecedores Aprovados": "Approved Suppliers",
  "Frameworks": "Frameworks",
  "Frameworks ISO encontrados": "ISO Frameworks Found",
  "Frameworks Monitorados": "Monitored Frameworks",
  "Governanca Documental": "Document Governance",
  "Gravidade Alta": "High Severity",
  "Gravidade Critica": "Critical Severity",
  "Historico de Testes": "Test History",
  "Incidentes (90 dias)": "Incidents (90 days)",
  "Incidentes Recentes": "Recent Incidents",
  "Inventario de Ativos": "Asset Inventory",
  "Itens Identificados": "Identified Items",
  "Itens de Auditoria": "Audit Items",
  "Itens em Aberto": "Open Items",
  "Licencas Cadastradas": "Registered Licenses",
  "Licencas Vencendo (90d)": "Licenses Expiring (90d)",
  "Lista de Ativos": "Asset List",
  "Lista de Contratos": "Contract List",
  "Lista de Incidentes": "Incident List",
  "Medios": "Medium",
  "Nao conformes": "Non-Compliant",
  "Panorama LGPD": "LGPD Overview",
  "Parcialmente conformes": "Partially Compliant",
  "Pendentes": "Pending",
  "Planos Ativos": "Active Plans",
  "Planos de Continuidade": "Continuity Plans",
  "Requisitos avaliados": "Requirements Assessed",
  "Resolvidos": "Resolved",
  "Resumo Executivo": "Executive Summary",
  "Resumo Executivo - Ultimos 90 dias": "Executive Summary - Last 90 days",
  "Resumo de Auditorias": "Audit Summary",
  "Resumo de Continuidade de Negocios": "Business Continuity Summary",
  "Resumo de Contratos": "Contract Summary",
  "Resumo de Incidentes": "Incident Summary",
  "Revisao Vencendo (30d)": "Review Due (30d)",
  "Riscos Ativos": "Active Risks",
  "Riscos Criticos": "Critical Risks",
  "Score Medio (0-10)": "Average Score (0-10)",
  "Solicitacoes de Titulares": "Data Subject Requests",
  "Status Geral de Compliance": "Overall Compliance Status",
  "Status ISO 27001": "ISO 27001 Status",
  "Tarefas Pendentes": "Pending Tasks",
  "Testes Realizados": "Tests Performed",
  "Testes com Sucesso": "Successful Tests",
  "Total de Assessments": "Total Assessments",
  "Total de Ativos": "Total Assets",
  "Total de Auditorias": "Total Audits",
  "Total de Contratos": "Total Contracts",
  "Total de Controles": "Total Controls",
  "Total de Denuncias": "Total Reports",
  "Total de Documentos": "Total Documents",
  "Total de Incidentes": "Total Incidents",
  "Total de Planos": "Total Plans",
  "Total de Riscos": "Total Risks",
  "Total de Tarefas": "Total Tasks",
  "Tratamentos Concluidos": "Completed Treatments",
  "Valor Total": "Total Value",
  "Vencendo (30d)": "Expiring (30d)",
  "Vencendo (90 dias)": "Expiring (90 days)",
  "Vencidos": "Expired",
  "Nome": "Name",
  "Nivel": "Level",
  "Status": "Status",
  "Responsavel": "Owner",
  "Titulo": "Title",
  "Categoria": "Category",
  "Criticidade": "Criticality",
  "Base Legal": "Legal Basis",
  "Sensibilidade": "Sensitivity",
  "Criado em": "Created At",
  "Versao": "Version",
  "Tipo": "Type",
  "RTO/RPO": "RTO/RPO",
  "Data": "Date",
  "Resultado": "Result",
  "Vencimento": "Expiration",
  "Quantidade": "Quantity",
  "Inicio": "Start",
  "Codigo": "Code",
  "Prioridade": "Priority",
  "Fornecedor": "Supplier",
  "Score": "Score",
  "Conclusao": "Conclusion",
  "Gravidade": "Severity",
  "Protocolo": "Protocol",
  "Nenhum dado encontrado para este template.": "No data found for this template.",
  "Verifique se ha dados cadastrados nos modulos correspondentes.": "Check whether data has been registered in the corresponding modules."
};

function tr(ptLabel: string): string {
  if (getAppLocale() === 'pt') return ptLabel;
  return PDF_LABELS[ptLabel] ?? ptLabel;
}


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
  // Mesma definicao de severidade do modulo de Riscos (camada unica de metricas)
  const { criticos, altos, medios, baixos } = contarRiscosPorSeveridade(r as any[]);
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
      { title: tr('Resumo Executivo'), metrics: [
        { label: tr('Total de Riscos'), value: r.length },
        { label: tr('Criticos'), value: criticos },
        { label: tr('Altos'), value: altos },
        { label: tr('Medios'), value: medios },
        { label: tr('Baixos'), value: baixos },
        { label: tr('Tratamentos Concluidos'), value: `${concluidos}/${t.length}` },
      ]},
      { title: tr('Detalhamento dos Riscos'), tableHeaders: [tr('Nome'), tr('Nivel'), tr('Status'), tr('Responsavel')],
        // `residual || inicial`: era o unico sitio do PDF ainda a mostrar so o
        // inerente, e contradizia o proprio resumo logo acima.
        tableRows: r.map(x => [x.nome, x.nivel_risco_residual || x.nivel_risco_inicial || '-', x.status || '-', respLabel(x.responsavel)]),
        colWidths: [60, 30, 35, 45] },
    ] as Section[]
  };
}

async function fetchIncidentesData(empresaId: string) {
  const { data: inc } = await supabase.from('incidentes').select('*').eq('empresa_id', empresaId).order('data_deteccao', { ascending: false });
  const i = inc || [];
  const critica = i.filter(x => severidadeDeFaixas(x.criticidade) === 'critico').length;
  const alta = i.filter(x => severidadeDeFaixas(x.criticidade) === 'alto').length;
  const resolvidos = i.filter(x => x.status === 'resolvido').length;
  return {
    sections: [
      { title: tr('Resumo de Incidentes'), metrics: [
        { label: tr('Total de Incidentes'), value: i.length },
        { label: tr('Gravidade Critica'), value: critica },
        { label: tr('Gravidade Alta'), value: alta },
        { label: tr('Resolvidos'), value: resolvidos },
      ]},
      { title: tr('Lista de Incidentes'), tableHeaders: [tr('Titulo'), tr('Categoria'), tr('Criticidade'), tr('Status')],
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
      { title: tr('Panorama LGPD'), metrics: [
        { label: tr('Dados Pessoais Mapeados'), value: d.length },
        { label: tr('Solicitacoes de Titulares'), value: s.length },
      ]},
      { title: tr('Dados Pessoais Mapeados'), tableHeaders: [tr('Nome'), tr('Categoria'), tr('Base Legal'), tr('Sensibilidade')],
        tableRows: d.map(x => [x.nome, x.categoria_dados || '-', x.base_legal || '-', x.sensibilidade || '-']),
        colWidths: [50, 35, 45, 40] },
      ...(s.length > 0 ? [{ title: tr('Solicitacoes de Titulares'), tableHeaders: [tr('Tipo'), tr('Status'), tr('Criado em')],
        tableRows: s.map((x: any) => [x.tipo_solicitacao || '-', x.status || '-', new Date(x.created_at).toLocaleDateString(intlLocale())]),
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
      { title: tr('Status ISO 27001'), metrics: [
        { label: tr('Frameworks ISO encontrados'), value: f.length },
        { label: tr('Requisitos avaliados'), value: isoEvals.length },
        { label: tr('Conformes'), value: conformes },
        { label: tr('Parcialmente conformes'), value: parciais },
        { label: tr('Nao conformes'), value: naoConformes },
        { label: tr('Total de Controles'), value: c.length },
        { label: tr('Controles Ativos'), value: ativos },
      ]},
      { title: tr('Controles Implementados'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Criticidade'), tr('Status')],
        tableRows: c.map(x => [x.nome, x.tipo || '-', x.criticidade || '-', x.status || '-']),
        colWidths: [55, 30, 40, 45] },
    ] as Section[]
  };
}

/**
 * Os frameworks que ESTA empresa acompanha.
 *
 * Os dois relatorios filtravam `gap_analysis_frameworks` por `ativo = true`, e
 * essa coluna nao existe: o PostgREST devolvia 400 (42703, «column
 * gap_analysis_frameworks.ativo does not exist»), o erro era engolido e a
 * lista ficava vazia. O «Frameworks Monitorados» do relatorio executivo dizia
 * SEMPRE zero, e a tabela de Frameworks do relatorio de compliance saia em
 * branco -- ambos em PDFs que vao para a direccao. Medido nesta base: a
 * empresa tem 117 avaliacoes de ISO/IEC 27001 e 10 de SOC 2 Type II.
 *
 * O catalogo e global (24 modelos, todos com `empresa_id` nulo): contar as 24
 * linhas seria trocar um zero por um numero igualmente falso. Uma empresa
 * acompanha um framework quando o avalia, e e isso que se conta aqui.
 */
async function frameworksDaEmpresa(empresaId: string) {
  const { data, error } = await (supabase as any)
    .from('gap_analysis_evaluations')
    .select('framework_id, gap_analysis_frameworks!inner(id, nome, versao, tipo_framework)')
    .eq('empresa_id', empresaId);
  if (error) throw error;

  const porId = new Map<string, any>();
  for (const linha of data ?? []) {
    const f = linha.gap_analysis_frameworks;
    if (f?.id && !porId.has(f.id)) porId.set(f.id, f);
  }
  return [...porId.values()];
}

async function fetchExecutivoData(empresaId: string) {
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { data: riscos } = await supabase.from('riscos').select('*').eq('empresa_id', empresaId);
  const { data: incidentes } = await (supabase.from('incidentes').select('*').eq('empresa_id', empresaId).gte('data_deteccao', ninetyDaysAgo.toISOString()) as any);
  const { data: controles } = await supabase.from('controles').select('*').eq('empresa_id', empresaId);
  const frameworks = await frameworksDaEmpresa(empresaId);
  const r = riscos || []; const i = incidentes || []; const c = controles || []; const f = frameworks || [];
  return {
    sections: [
      { title: tr('Resumo Executivo - Ultimos 90 dias'), metrics: [
        { label: tr('Riscos Ativos'), value: r.length },
        { label: tr('Riscos Criticos'), value: r.filter(x => severidadeRisco(x as any) === 'critico').length },
        { label: tr('Incidentes (90 dias)'), value: i.length },
        { label: tr('Controles Ativos'), value: c.filter(x => x.status === 'ativo').length },
        { label: tr('Frameworks Monitorados'), value: f.length },
      ]},
      { title: tr('Incidentes Recentes'), tableHeaders: [tr('Titulo'), tr('Gravidade'), tr('Status')],
        tableRows: i.slice(0, 15).map(x => [x.titulo, x.criticidade || '-', x.status || '-']),
        colWidths: [80, 45, 45] },
    ] as Section[]
  };
}

async function fetchComplianceData(empresaId: string) {
  const frameworks = await frameworksDaEmpresa(empresaId);
  const { data: controles } = await supabase.from('controles').select('*').eq('empresa_id', empresaId);
  const { data: auditorias } = await supabase.from('auditorias').select('*').eq('empresa_id', empresaId);
  const f = (frameworks || []) as any[]; const c = controles || []; const a = auditorias || [];
  return {
    sections: [
      { title: tr('Status Geral de Compliance'), metrics: [
        { label: tr('Frameworks'), value: f.length },
        { label: tr('Controles'), value: c.length },
        { label: tr('Controles Ativos'), value: c.filter(x => x.status === 'ativo').length },
        { label: tr('Auditorias'), value: a.length },
      ]},
      { title: tr('Frameworks'), tableHeaders: [tr('Nome'), tr('Versao'), tr('Tipo')],
        tableRows: f.map(x => [x.nome, x.versao || '-', x.tipo_framework || '-']),
        colWidths: [80, 40, 50] },
      { title: tr('Auditorias'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Status')],
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
  const planosVencendo = p.filter((x: any) => x.proxima_revisao && parseDataLocal(x.proxima_revisao) < new Date(hoje.getTime() + 30 * 86400000)).length;
  const tarefasPendentes = t.filter((x: any) => x.status !== 'concluida').length;
  const testesSucesso = te.filter((x: any) => x.resultado === 'sucesso').length;
  return {
    sections: [
      { title: tr('Resumo de Continuidade de Negocios'), metrics: [
        { label: tr('Total de Planos'), value: p.length },
        { label: tr('Planos Ativos'), value: p.filter((x: any) => x.status === 'ativo').length },
        { label: tr('Em Revisao'), value: p.filter((x: any) => x.status === 'em_revisao').length },
        { label: tr('Revisao Vencendo (30d)'), value: planosVencendo },
        { label: tr('Total de Tarefas'), value: t.length },
        { label: tr('Tarefas Pendentes'), value: tarefasPendentes },
        { label: tr('Testes Realizados'), value: te.length },
        { label: tr('Testes com Sucesso'), value: testesSucesso },
      ]},
      { title: tr('Planos de Continuidade'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Status'), tr('RTO/RPO')],
        tableRows: p.map((x: any) => [x.nome, x.tipo || '-', x.status || '-', `${x.rto_horas || '-'}h / ${x.rpo_horas || '-'}h`]),
        colWidths: [70, 30, 35, 35] },
      ...(te.length > 0 ? [{ title: tr('Historico de Testes'), tableHeaders: [tr('Tipo'), tr('Data'), tr('Resultado')],
        tableRows: te.map((x: any) => [x.tipo_teste || '-', x.data_teste ? parseDataLocal(x.data_teste).toLocaleDateString(intlLocale()) : '-', x.resultado || '-']),
        colWidths: [60, 50, 60] }] : []),
    ] as Section[]
  };
}

async function fetchContratosData(empresaId: string) {
  const { data: contratos } = await supabase.from('contratos').select('*').eq('empresa_id', empresaId);
  const c = contratos || [];
  const hoje = new Date();
  const ativos = c.filter((x: any) => x.status === 'ativo').length;
  const vencendo = c.filter((x: any) => x.data_fim && parseDataLocal(x.data_fim) > hoje && parseDataLocal(x.data_fim) < new Date(hoje.getTime() + 90 * 86400000)).length;
  const vencidos = c.filter((x: any) => x.data_fim && parseDataLocal(x.data_fim) < hoje).length;
  /* Somado POR MOEDA, e não num monte só rotulado «(BRL)».
     O relatório é o que se imprime e se manda ao auditor: dizia «Valor
     Total (BRL)» a qualquer carteira, mesmo à que estava toda em euros. */
  const porMoeda = somaPorMoeda(c as any, () => true);
  return {
    sections: [
      { title: tr('Resumo de Contratos'), metrics: [
        { label: tr('Total de Contratos'), value: c.length },
        { label: tr('Contratos Ativos'), value: ativos },
        { label: tr('Vencendo (90 dias)'), value: vencendo },
        { label: tr('Vencidos'), value: vencidos },
        { label: tr('Valor Total'), value: formatMoedasSomadas(porMoeda, getMoedaAtual()) },
      ]},
      { title: tr('Lista de Contratos'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Status'), tr('Vencimento')],
        tableRows: c.map((x: any) => [x.nome || x.numero_contrato || '-', x.tipo || '-', x.status || '-', x.data_fim ? parseDataLocal(x.data_fim).toLocaleDateString(intlLocale()) : '-']),
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
  const criticos = a.filter((x: any) => ['critico', 'alto'].includes(severidadeDeFaixas(x.criticidade))).length;
  const hoje = new Date();
  const licencasVencendo = l.filter((x: any) => x.data_vencimento && parseDataLocal(x.data_vencimento) > hoje && parseDataLocal(x.data_vencimento) < new Date(hoje.getTime() + 90 * 86400000)).length;
  return {
    sections: [
      { title: tr('Inventario de Ativos'), metrics: [
        { label: tr('Total de Ativos'), value: a.length },
        { label: tr('Ativos de Criticidade Alta ou Critica'), value: criticos },
        { label: tr('Licencas Cadastradas'), value: l.length },
        { label: tr('Licencas Vencendo (90d)'), value: licencasVencendo },
        { label: tr('Chaves Criptograficas'), value: k.length },
      ]},
      { title: tr('Distribuicao por Tipo'), tableHeaders: [tr('Tipo'), tr('Quantidade')],
        tableRows: Object.entries(tipos).map(([t, q]) => [t, String(q)]),
        colWidths: [120, 50] },
      { title: tr('Lista de Ativos'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Criticidade'), tr('Status')],
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
      { title: tr('Resumo de Auditorias'), metrics: [
        { label: tr('Total de Auditorias'), value: a.length },
        { label: tr('Em Andamento'), value: emAndamento },
        { label: tr('Concluidas'), value: concluidas },
        { label: tr('Itens Identificados'), value: i.length },
        { label: tr('Itens em Aberto'), value: itensAbertos },
      ]},
      { title: tr('Auditorias'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Status'), tr('Inicio')],
        tableRows: a.map((x: any) => [x.nome, x.tipo || '-', x.status || '-', x.data_inicio ? parseDataLocal(x.data_inicio).toLocaleDateString(intlLocale()) : '-']),
        colWidths: [70, 30, 35, 35] },
      ...(i.length > 0 ? [{ title: tr('Itens de Auditoria'), tableHeaders: [tr('Codigo'), tr('Titulo'), tr('Prioridade'), tr('Status')],
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
      { title: tr('Due Diligence de Fornecedores'), metrics: [
        { label: tr('Total de Assessments'), value: dd.length },
        { label: tr('Concluidos'), value: concluidos.length },
        { label: tr('Pendentes'), value: pendentes },
        { label: tr('Score Medio (0-10)'), value: scoreMedio },
        { label: tr('Fornecedores Aprovados'), value: aprovados },
      ]},
      { title: tr('Assessments'), tableHeaders: [tr('Fornecedor'), tr('Status'), tr('Score'), tr('Conclusao')],
        tableRows: dd.map((x: any) => [
          x.fornecedor_nome || '-',
          x.status || '-',
          x.score_final != null ? String(x.score_final) : '-',
          x.data_conclusao ? parseDataLocal(x.data_conclusao).toLocaleDateString(intlLocale()) : '-'
        ]),
        colWidths: [70, 35, 25, 40] },
    ] as Section[]
  };
}

async function fetchDocumentosData(empresaId: string) {
  const { data: docs } = await supabase.from('documentos').select('*').eq('empresa_id', empresaId);
  const d = docs || [];
  /*
     As mesmas contas do ecrã, e não as suas.

     Estavam escritas à mão e divergiam em três pontos: «Ativos» só via
     `status = 'ativo'` e perdia «publicado» e «vigente»; «Aprovados»
     procurava um estado «aprovado» que o produto não grava, em vez de
     olhar para `data_aprovacao`; e «Vencidos» contava qualquer documento
     fora do prazo, RASCUNHOS incluídos.

     Medido nesta base: o ecrã dizia «Vencidos: 0» e o PDF dizia 1 — o
     documento em causa é um rascunho, e um rascunho nunca teve vigência
     para expirar. Num relatório que vai para a direcção, dois números
     diferentes para a mesma pergunta é pior do que qualquer um deles.
  */
  const contagem = contarDocumentos(d);
  const ativos = contagem.ativos;
  const aprovados = contagem.aprovados;
  const vencidos = contagem.vencidos;
  const vencendo = contagem.vencendo30Dias;
  const tipos: Record<string, number> = {};
  d.forEach((x: any) => { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
  return {
    sections: [
      { title: tr('Governanca Documental'), metrics: [
        { label: tr('Total de Documentos'), value: d.length },
        { label: tr('Ativos'), value: ativos },
        { label: tr('Aprovados'), value: aprovados },
        { label: tr('Vencidos'), value: vencidos },
        { label: tr('Vencendo (30d)'), value: vencendo },
      ]},
      { title: tr('Distribuicao por Tipo'), tableHeaders: [tr('Tipo'), tr('Quantidade')],
        tableRows: Object.entries(tipos).map(([t, q]) => [t, String(q)]),
        colWidths: [120, 50] },
      { title: tr('Documentos'), tableHeaders: [tr('Nome'), tr('Tipo'), tr('Status'), tr('Vencimento')],
        tableRows: d.slice(0, 50).map((x: any) => [(x.nome || '').substring(0, 40), x.tipo || '-', x.status || '-', x.data_vencimento ? parseDataLocal(x.data_vencimento).toLocaleDateString(intlLocale()) : '-']),
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
      { title: tr('Canal de Etica'), metrics: [
        { label: tr('Total de Denuncias'), value: d.length },
        { label: tr('Em Aberto/Investigacao'), value: abertas },
        { label: tr('Concluidas'), value: concluidas },
        { label: tr('Anonimas'), value: anonimas },
      ]},
      { title: tr('Distribuicao por Gravidade'), tableHeaders: [tr('Gravidade'), tr('Quantidade')],
        tableRows: Object.entries(grav).map(([g, q]) => [g, String(q)]),
        colWidths: [120, 50] },
      { title: tr('Denuncias'), tableHeaders: [tr('Protocolo'), tr('Titulo'), tr('Gravidade'), tr('Status')],
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
    data: new Date().toLocaleDateString(intlLocale())
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
    doc.text(tr('Nenhum dado encontrado para este template.'), 105, 140, { align: 'center' });
    doc.text(tr('Verifique se ha dados cadastrados nos modulos correspondentes.'), 105, 155, { align: 'center' });
  }

  addAkurisFooter(doc);
  doc.save(`${relatorio.nome.replace(/\s+/g, '_')}.pdf`);
}
