import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  JURISDICAO_CONFIG,
  DIREITOS_TITULAR,
  inferirJurisdicao,
  setJurisdicaoAtual,
  type JurisdicaoCodigo,
  type JurisdicaoConfig,
} from '@/lib/jurisdicao';

/**
 * Jurisdição de proteção de dados da empresa autenticada.
 * Quando não configurada, é inferida do idioma/fuso/domínio.
 */
export function useJurisdicao() {
  const { profile } = useAuth();
  const { t, locale } = useLanguage();
  const empresaId = profile?.empresa_id;

  const { data } = useQuery({
    queryKey: ['empresa-jurisdicao', empresaId],
    queryFn: async (): Promise<JurisdicaoCodigo | null> => {
      const { data, error } = await supabase
        .from('empresas')
        .select('jurisdicao')
        .eq('id', empresaId!)
        .maybeSingle();
      if (error) throw error;
      const value = (data as any)?.jurisdicao as JurisdicaoCodigo | undefined;
      return value && JURISDICAO_CONFIG[value] ? value : null;
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 30,
  });

  const codigo: JurisdicaoCodigo = data || inferirJurisdicao(locale);
  setJurisdicaoAtual(codigo);

  const config: JurisdicaoConfig = JURISDICAO_CONFIG[codigo];

  return useMemo(
    () => ({
      codigo,
      config,
      /** Designação da lei aplicável (LGPD / RGPD / GDPR). */
      lei: config.lei,
      /** Autoridade de controlo (sigla ou termo genérico traduzido). */
      autoridade: config.autoridade || t(config.autoridadeKey),
      autoridadeNome: t(config.autoridadeKey),
      prazoTitularDias: config.prazoTitularDias,
      /** Texto legível do prazo de resposta ao titular. */
      prazoTitularLabel: t(config.prazoTitularKey),
      /** Texto legível do prazo de notificação de violação. */
      prazoViolacaoLabel: t(config.prazoViolacaoKey),
      /** Base legal citada (artigo). */
      artigoTitular: t(config.artigoTitularKey),
      /** Nomes dos direitos do titular na jurisdição ativa. */
      direitos: DIREITOS_TITULAR[codigo].map((k) => ({ key: k, label: t(`jurisdicao.direitos.${k}`) })),
      /** Rótulo da jurisdição para seletores. */
      label: t(`jurisdicao.opcoes.${codigo}`),
    }),
    [codigo, config, t],
  );
}
