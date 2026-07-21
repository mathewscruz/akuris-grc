import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { ProgramaTemplate } from '@/lib/programa-templates';

// Tabelas novas ainda não estão no types gerado — cast único.
const sb = supabase as any;

export type ProgramaStatus = 'em_andamento' | 'concluido' | 'pausado';
export type ItemStatus = 'pendente' | 'em_andamento' | 'concluido';
export type Nivel = 'baixo' | 'medio' | 'alto';

export interface Programa {
  id: string;
  empresa_id: string;
  framework_id: string | null;
  nome: string;
  descricao: string | null;
  data_alvo: string | null;
  orcamento_total: number | null;
  status: ProgramaStatus;
  created_at: string;
  framework_nome?: string | null;
  /** computados */
  total_itens?: number;
  itens_concluidos?: number;
  custo_estimado?: number;
}

export interface ProgramaFase {
  id: string;
  programa_id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  orcamento: number | null;
}

export type FerramentaStatus = 'planejada' | 'avaliando' | 'contratada';
export interface ProgramaFerramenta {
  id: string;
  programa_id: string;
  fase_id: string | null;
  nome: string;
  categoria: string | null;
  fornecedor: string | null;
  custo: number | null;
  recorrencia: 'unica' | 'mensal' | 'anual';
  status: FerramentaStatus;
  observacoes: string | null;
}

export interface ProgramaItem {
  id: string;
  programa_id: string;
  fase_id: string | null;
  titulo: string;
  descricao: string | null;
  requirement_id: string | null;
  controle_id: string | null;
  plano_acao_id: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  esforco: Nivel | null;
  impacto: Nivel | null;
  custo_estimado: number | null;
  ferramenta_sugerida: string | null;
  status: ItemStatus;
  ordem: number;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Semeia fases + itens de um modelo num programa recém-criado (ou vazio). */
export async function seedProgramaFromTemplate(empresaId: string, programaId: string, template: ProgramaTemplate): Promise<void> {
  const uid = await currentUserId();
  for (let fi = 0; fi < template.fases.length; fi++) {
    const fase = template.fases[fi];
    const { data: f, error } = await sb.from('programa_fases')
      .insert({ empresa_id: empresaId, programa_id: programaId, nome: fase.nome, ordem: fi })
      .select('id').single();
    if (error || !f) { logger.error('seedPrograma.fase', error); continue; }
    const itens = fase.itens.map((it, ii) => ({
      empresa_id: empresaId,
      programa_id: programaId,
      fase_id: f.id,
      titulo: it.titulo,
      descricao: it.descricao ?? null,
      esforco: it.esforco ?? null,
      impacto: it.impacto ?? null,
      custo_estimado: it.custo_estimado ?? null,
      ferramenta_sugerida: it.ferramenta_sugerida ?? null,
      status: 'pendente',
      ordem: ii,
      created_by: uid,
    }));
    if (itens.length > 0) {
      const { error: iErr } = await sb.from('programa_itens').insert(itens);
      if (iErr) logger.error('seedPrograma.itens', iErr);
    }
  }
}

/** Lista de programas da empresa, com estatísticas agregadas. */
export function useProgramas(empresaId: string | null) {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('implementacao_programas')
        .select('*, framework:gap_analysis_frameworks(nome)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const progs = data || [];
      const ids = progs.map((p: any) => p.id);
      const stats: Record<string, { total: number; done: number; custo: number }> = {};
      if (ids.length > 0) {
        const { data: itens } = await sb
          .from('programa_itens')
          .select('programa_id, status, custo_estimado')
          .in('programa_id', ids);
        for (const it of (itens || []) as any[]) {
          const s = stats[it.programa_id] || { total: 0, done: 0, custo: 0 };
          s.total++;
          if (it.status === 'concluido') s.done++;
          s.custo += Number(it.custo_estimado || 0);
          stats[it.programa_id] = s;
        }
      }
      setProgramas(progs.map((p: any) => ({
        ...p,
        framework_nome: p.framework?.nome ?? null,
        total_itens: stats[p.id]?.total || 0,
        itens_concluidos: stats[p.id]?.done || 0,
        custo_estimado: stats[p.id]?.custo || 0,
      })));
    } catch (e) {
      logger.error('useProgramas.fetchAll', e);
      toast.error('Não foi possível carregar os programas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createPrograma = useCallback(async (input: {
    nome: string; framework_id?: string | null; descricao?: string; data_alvo?: string | null; orcamento_total?: number | null;
  }, template?: ProgramaTemplate | null): Promise<Programa | null> => {
    if (!empresaId) return null;
    try {
      const { data, error } = await sb.from('implementacao_programas').insert({
        empresa_id: empresaId,
        nome: input.nome,
        framework_id: input.framework_id || null,
        descricao: input.descricao || null,
        data_alvo: input.data_alvo || null,
        orcamento_total: input.orcamento_total ?? null,
        created_by: await currentUserId(),
      }).select('*').single();
      if (error) throw error;
      if (template) await seedProgramaFromTemplate(empresaId, data.id, template);
      await fetchAll();
      return data as Programa;
    } catch (e) {
      logger.error('useProgramas.createPrograma', e);
      toast.error('Erro ao criar programa.');
      return null;
    }
  }, [empresaId, fetchAll]);

  const deletePrograma = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await sb.from('implementacao_programas').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) {
      logger.error('useProgramas.deletePrograma', e);
      toast.error('Erro ao excluir programa.');
      return false;
    }
  }, [fetchAll]);

  return { programas, loading, fetchAll, createPrograma, deletePrograma };
}

/** Detalhe de um programa: fases + itens + mutações. */
export function useProgramaDetalhe(programaId: string | undefined, empresaId: string | null) {
  const [programa, setPrograma] = useState<Programa | null>(null);
  const [fases, setFases] = useState<ProgramaFase[]>([]);
  const [itens, setItens] = useState<ProgramaItem[]>([]);
  const [ferramentas, setFerramentas] = useState<ProgramaFerramenta[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!programaId) return;
    setLoading(true);
    try {
      const [pRes, fRes, iRes, tRes] = await Promise.all([
        sb.from('implementacao_programas').select('*, framework:gap_analysis_frameworks(nome)').eq('id', programaId).maybeSingle(),
        sb.from('programa_fases').select('*').eq('programa_id', programaId).order('ordem', { ascending: true }),
        sb.from('programa_itens').select('*').eq('programa_id', programaId).order('ordem', { ascending: true }),
        sb.from('programa_ferramentas').select('*').eq('programa_id', programaId).order('created_at', { ascending: true }),
      ]);
      setPrograma(pRes.data ? { ...pRes.data, framework_nome: pRes.data.framework?.nome ?? null } : null);
      setFases((fRes.data || []) as ProgramaFase[]);
      setItens((iRes.data || []) as ProgramaItem[]);
      setFerramentas((tRes.data || []) as ProgramaFerramenta[]);
    } catch (e) {
      logger.error('useProgramaDetalhe.fetchAll', e);
      toast.error('Não foi possível carregar o programa.');
    } finally {
      setLoading(false);
    }
  }, [programaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updatePrograma = useCallback(async (patch: Partial<Programa>): Promise<boolean> => {
    if (!programaId) return false;
    try {
      const { error } = await sb.from('implementacao_programas').update(patch).eq('id', programaId);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('updatePrograma', e); toast.error('Erro ao atualizar programa.'); return false; }
  }, [programaId, fetchAll]);

  const aplicarTemplate = useCallback(async (template: ProgramaTemplate): Promise<boolean> => {
    if (!programaId || !empresaId) return false;
    try {
      await seedProgramaFromTemplate(empresaId, programaId, template);
      await fetchAll();
      return true;
    } catch (e) { logger.error('aplicarTemplate', e); toast.error('Erro ao aplicar o modelo.'); return false; }
  }, [programaId, empresaId, fetchAll]);

  const addFase = useCallback(async (nome: string): Promise<boolean> => {
    if (!programaId || !empresaId) return false;
    try {
      const ordem = fases.length;
      const { error } = await sb.from('programa_fases').insert({ empresa_id: empresaId, programa_id: programaId, nome, ordem });
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('addFase', e); toast.error('Erro ao criar fase.'); return false; }
  }, [programaId, empresaId, fases.length, fetchAll]);

  const updateFase = useCallback(async (id: string, patch: { nome?: string; orcamento?: number | null }): Promise<boolean> => {
    try {
      const { error } = await sb.from('programa_fases').update(patch).eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('updateFase', e); toast.error('Erro ao atualizar fase.'); return false; }
  }, [fetchAll]);

  const deleteFase = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await sb.from('programa_fases').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('deleteFase', e); toast.error('Erro ao excluir fase.'); return false; }
  }, [fetchAll]);

  const saveFerramenta = useCallback(async (input: Partial<ProgramaFerramenta> & { id?: string }): Promise<boolean> => {
    if (!programaId || !empresaId) return false;
    try {
      const payload: any = {
        nome: input.nome,
        categoria: input.categoria ?? null,
        fornecedor: input.fornecedor ?? null,
        custo: input.custo ?? null,
        recorrencia: input.recorrencia ?? 'anual',
        status: input.status ?? 'planejada',
        fase_id: input.fase_id ?? null,
        observacoes: input.observacoes ?? null,
      };
      if (input.id) {
        const { error } = await sb.from('programa_ferramentas').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        payload.empresa_id = empresaId;
        payload.programa_id = programaId;
        payload.created_by = await currentUserId();
        const { error } = await sb.from('programa_ferramentas').insert(payload);
        if (error) throw error;
      }
      await fetchAll();
      return true;
    } catch (e) { logger.error('saveFerramenta', e); toast.error('Erro ao salvar ferramenta.'); return false; }
  }, [programaId, empresaId, fetchAll]);

  const deleteFerramenta = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await sb.from('programa_ferramentas').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('deleteFerramenta', e); toast.error('Erro ao excluir ferramenta.'); return false; }
  }, [fetchAll]);

  const saveItem = useCallback(async (input: Partial<ProgramaItem> & { id?: string }): Promise<boolean> => {
    if (!programaId || !empresaId) return false;
    try {
      const payload: any = {
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        fase_id: input.fase_id ?? null,
        requirement_id: input.requirement_id ?? null,
        responsavel_id: input.responsavel_id ?? null,
        prazo: input.prazo ?? null,
        esforco: input.esforco ?? null,
        impacto: input.impacto ?? null,
        custo_estimado: input.custo_estimado ?? null,
        ferramenta_sugerida: input.ferramenta_sugerida ?? null,
        status: input.status ?? 'pendente',
      };
      if (input.id) {
        const { error } = await sb.from('programa_itens').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        payload.empresa_id = empresaId;
        payload.programa_id = programaId;
        payload.ordem = itens.length;
        payload.created_by = await currentUserId();
        const { error } = await sb.from('programa_itens').insert(payload);
        if (error) throw error;
      }
      await fetchAll();
      return true;
    } catch (e) { logger.error('saveItem', e); toast.error('Erro ao salvar item.'); return false; }
  }, [programaId, empresaId, itens.length, fetchAll]);

  const setItemStatus = useCallback(async (id: string, status: ItemStatus): Promise<boolean> => {
    try {
      const { error } = await sb.from('programa_itens').update({ status }).eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('setItemStatus', e); toast.error('Erro ao atualizar item.'); return false; }
  }, [fetchAll]);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await sb.from('programa_itens').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (e) { logger.error('deleteItem', e); toast.error('Erro ao excluir item.'); return false; }
  }, [fetchAll]);

  return { programa, fases, itens, ferramentas, loading, fetchAll, updatePrograma, aplicarTemplate, addFase, updateFase, deleteFase, saveItem, setItemStatus, deleteItem, saveFerramenta, deleteFerramenta };
}
