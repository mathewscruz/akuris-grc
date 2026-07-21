import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { invokeEdgeFunction } from '@/lib/edge-function-utils';
import { akurisToast } from '@/lib/akuris-toast';
import { toast } from 'sonner';

export interface EvidenceLibraryItem {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  tags: string[] | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  arquivo_hash: string | null;
  link_externo: string | null;
  origem_evaluation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** computado: total de links ativos */
  total_links?: number;
  /** computado: total de sugestões IA pendentes */
  total_sugestoes?: number;
}

export interface EvidenceLibraryLink {
  id: string;
  empresa_id: string;
  evidence_id: string;
  evaluation_id: string;
  requirement_id: string;
  framework_id: string;
  vinculo_tipo: 'manual' | 'sugestao_ia';
  ia_score: number | null;
  ia_justificativa: string | null;
  aceito_em: string | null;
  aceito_por: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrossMatchSuggestion {
  requirement_id: string;
  framework_id: string;
  framework_nome: string | null;
  codigo: string | null;
  titulo: string;
  categoria: string | null;
  score: number;
  justificativa: string;
  evaluation_id: string;
}

const BUCKET = 'gap-evidence-library';

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useEvidenceLibrary(empresaId: string | null) {
  const [items, setItems] = useState<EvidenceLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data: evidences, error } = await supabase
        .from('evidence_library')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Conta links por evidência
      const ids = (evidences || []).map((e) => e.id);
      let linkCounts: Record<string, { total: number; sugestoes: number }> = {};
      if (ids.length > 0) {
        const { data: links } = await supabase
          .from('evidence_library_links')
          .select('evidence_id, vinculo_tipo, aceito_em')
          .eq('empresa_id', empresaId)
          .in('evidence_id', ids);
        for (const l of (links || []) as any[]) {
          const slot = linkCounts[l.evidence_id] || { total: 0, sugestoes: 0 };
          if (l.vinculo_tipo === 'sugestao_ia' && !l.aceito_em) slot.sugestoes++;
          else slot.total++;
          linkCounts[l.evidence_id] = slot;
        }
      }

      setItems(
        (evidences || []).map((e: any) => ({
          ...e,
          total_links: linkCounts[e.id]?.total || 0,
          total_sugestoes: linkCounts[e.id]?.sugestoes || 0,
        })) as EvidenceLibraryItem[],
      );
    } catch (err) {
      logger.error('useEvidenceLibrary.fetchAll', err);
      toast.error('Não foi possível carregar a biblioteca de evidências.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** Faz upload do arquivo, calcula hash e cria entrada (deduplicando se hash já existe). */
  const uploadAndCreate = useCallback(async (params: {
    file?: File | null;
    nome: string;
    descricao?: string;
    tags?: string[];
    link_externo?: string;
    origem_evaluation_id?: string | null;
  }): Promise<EvidenceLibraryItem | null> => {
    if (!empresaId) return null;
    try {
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      let arquivo_tipo: string | null = null;
      let arquivo_tamanho: number | null = null;
      let arquivo_hash: string | null = null;

      if (params.file) {
        const buf = await params.file.arrayBuffer();
        arquivo_hash = await sha256(buf);

        // Dedup: se já existe na empresa com o mesmo hash, devolve a existente
        const { data: dup } = await supabase
          .from('evidence_library')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('arquivo_hash', arquivo_hash)
          .maybeSingle();
        if (dup) {
          akurisToast({ module: 'gap', tone: 'info', title: 'Arquivo já existe na biblioteca', description: dup.nome });
          await fetchAll();
          return dup as EvidenceLibraryItem;
        }

        const safeName = params.file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${empresaId}/${arquivo_hash.slice(0, 16)}-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.file, {
          contentType: params.file.type || 'application/octet-stream',
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
        arquivo_url = signed?.signedUrl || path;
        arquivo_nome = params.file.name;
        arquivo_tipo = params.file.type || null;
        arquivo_tamanho = params.file.size;
      }

      const { data, error } = await supabase
        .from('evidence_library')
        .insert({
          empresa_id: empresaId,
          nome: params.nome,
          descricao: params.descricao || null,
          tags: params.tags || [],
          arquivo_url,
          arquivo_nome,
          arquivo_tipo,
          arquivo_tamanho,
          arquivo_hash,
          link_externo: params.link_externo || null,
          origem_evaluation_id: params.origem_evaluation_id || null,
        })
        .select('*')
        .single();
      if (error) throw error;

      await fetchAll();
      return data as EvidenceLibraryItem;
    } catch (err) {
      logger.error('useEvidenceLibrary.uploadAndCreate', err);
      toast.error('Erro ao adicionar evidência à biblioteca.');
      return null;
    }
  }, [empresaId, fetchAll]);

  /** Atualiza metadados de uma evidência (nome, descrição, tags, link). */
  const updateEvidence = useCallback(async (id: string, patch: {
    nome?: string;
    descricao?: string | null;
    tags?: string[];
    link_externo?: string | null;
  }): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      const { error } = await supabase
        .from('evidence_library')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.updateEvidence', err);
      toast.error('Erro ao atualizar evidência.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Exclui uma evidência e seus vínculos. */
  const deleteEvidence = useCallback(async (id: string): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      // Remove vínculos primeiro (evita erro de FK se não houver cascade)
      await supabase
        .from('evidence_library_links')
        .delete()
        .eq('evidence_id', id)
        .eq('empresa_id', empresaId);
      const { error } = await supabase
        .from('evidence_library')
        .delete()
        .eq('id', id)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.deleteEvidence', err);
      toast.error('Erro ao excluir evidência.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Vincula evidência a uma evaluation (manual). */
  const linkToEvaluation = useCallback(async (params: {
    evidence_id: string;
    evaluation_id: string;
    requirement_id: string;
    framework_id: string;
  }): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      const { error } = await supabase
        .from('evidence_library_links')
        .upsert({
          empresa_id: empresaId,
          evidence_id: params.evidence_id,
          evaluation_id: params.evaluation_id,
          requirement_id: params.requirement_id,
          framework_id: params.framework_id,
          vinculo_tipo: 'manual',
          aceito_em: new Date().toISOString(),
        }, { onConflict: 'evidence_id,evaluation_id', ignoreDuplicates: false });
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.linkToEvaluation', err);
      toast.error('Erro ao vincular evidência.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Vincula uma evidência a um registro de qualquer módulo (polimórfico). */
  const linkToRecord = useCallback(async (params: {
    evidence_id: string;
    modulo: string;
    registro_id: string;
  }): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      const { error } = await supabase
        .from('evidence_library_links')
        .insert({
          empresa_id: empresaId,
          evidence_id: params.evidence_id,
          modulo: params.modulo,
          registro_id: params.registro_id,
          vinculo_tipo: 'manual',
          aceito_em: new Date().toISOString(),
        } as any);
      // 23505 = unique_violation → já estava vinculado, tratamos como sucesso
      if (error && (error as any).code !== '23505') throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.linkToRecord', err);
      toast.error('Erro ao vincular evidência ao registro.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Lista os vínculos (com a evidência embutida) de um registro de módulo. */
  const fetchLinksForRecord = useCallback(async (
    modulo: string,
    registro_id: string,
  ): Promise<Array<{ id: string; evidence: EvidenceLibraryItem }>> => {
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from('evidence_library_links')
      .select('id, evidence:evidence_library(*)')
      .eq('empresa_id', empresaId)
      .eq('modulo', modulo)
      .eq('registro_id', registro_id)
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('useEvidenceLibrary.fetchLinksForRecord', error);
      return [];
    }
    return (data || []) as any;
  }, [empresaId]);

  /** Aceita uma sugestão IA (preenche aceito_em/aceito_por). */
  const acceptSuggestion = useCallback(async (linkId: string): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('evidence_library_links')
        .update({ aceito_em: new Date().toISOString(), aceito_por: user?.id || null })
        .eq('id', linkId)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.acceptSuggestion', err);
      toast.error('Erro ao aceitar sugestão.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Remove vínculo (desvincular). */
  const unlink = useCallback(async (linkId: string): Promise<boolean> => {
    if (!empresaId) return false;
    try {
      const { error } = await supabase
        .from('evidence_library_links')
        .delete()
        .eq('id', linkId)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      await fetchAll();
      return true;
    } catch (err) {
      logger.error('useEvidenceLibrary.unlink', err);
      toast.error('Erro ao desvincular.');
      return false;
    }
  }, [empresaId, fetchAll]);

  /** Roda cross-match IA para uma evidência. */
  const runCrossMatch = useCallback(async (
    evidence_id: string,
    options?: { framework_ids?: string[]; max_candidates?: number },
  ): Promise<{ suggestions: CrossMatchSuggestion[]; persisted: number } | null> => {
    if (!empresaId) return null;
    const { data, error } = await invokeEdgeFunction<{ suggestions: CrossMatchSuggestion[]; persisted: number }>(
      'evidence-cross-match',
      {
        body: { evidence_id, empresa_id: empresaId, ...options },
      },
    );
    if (error || !data) return null;
    await fetchAll();
    return data;
  }, [empresaId, fetchAll]);

  /** Busca os links de uma evidência específica. */
  const fetchLinks = useCallback(async (evidence_id: string): Promise<EvidenceLibraryLink[]> => {
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from('evidence_library_links')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('evidence_id', evidence_id)
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('useEvidenceLibrary.fetchLinks', error);
      return [];
    }
    return (data || []) as EvidenceLibraryLink[];
  }, [empresaId]);

  /** Sugestões IA pendentes para um requisito. */
  const fetchSuggestionsForRequirement = useCallback(async (requirement_id: string) => {
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from('evidence_library_links')
      .select('*, evidence:evidence_library(*)')
      .eq('empresa_id', empresaId)
      .eq('requirement_id', requirement_id)
      .eq('vinculo_tipo', 'sugestao_ia')
      .is('aceito_em', null);
    if (error) {
      logger.error('useEvidenceLibrary.fetchSuggestionsForRequirement', error);
      return [];
    }
    return data || [];
  }, [empresaId]);

  const stats = useMemo(() => ({
    total: items.length,
    com_links: items.filter((i) => (i.total_links || 0) > 0).length,
    com_sugestoes: items.filter((i) => (i.total_sugestoes || 0) > 0).length,
  }), [items]);

  return {
    items,
    loading,
    stats,
    fetchAll,
    uploadAndCreate,
    updateEvidence,
    deleteEvidence,
    linkToRecord,
    fetchLinksForRecord,
    linkToEvaluation,
    acceptSuggestion,
    unlink,
    runCrossMatch,
    fetchLinks,
    fetchSuggestionsForRequirement,
  };
}
