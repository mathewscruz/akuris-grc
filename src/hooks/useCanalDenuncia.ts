/**
 * useCanalDenuncia — a identidade e os direitos do canal, num sítio só.
 *
 * As três telas públicas — menu, registo e consulta — carregavam a empresa
 * cada uma à sua maneira e nenhuma lia a configuração de marca. O resultado
 * era um ecrã de definições cujas definições não faziam nada: cor, nome de
 * exibição e idioma existiam na base, tinham formulário, e não chegavam a
 * lado nenhum.
 *
 * Aqui resolve-se uma vez: quem é a empresa, que cor usa o canal, com que
 * nome se apresenta, e o que a Diretiva (UE) 2019/1937 obriga a dizer a quem
 * denuncia — via externa, proteção contra retaliação e prazo de conservação.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchEmpresaPublicaPorSlug, type EmpresaPublica } from '@/lib/denuncia-publica';
import { logger } from '@/lib/logger';

export interface ConfigCanal {
  id: string;
  texto_apresentacao: string | null;
  politica_privacidade: string | null;
  permitir_anonimas: boolean;
  requerer_email: boolean;
  nome_exibicao: string | null;
  cor_destaque: string | null;
  idioma_padrao: string | null;
  orgao_externo_nome: string | null;
  orgao_externo_url: string | null;
  texto_retaliacao: string | null;
  retencao_meses: number | null;
  permitir_reuniao: boolean | null;
  prazo_acusacao_dias: number | null;
  prazo_retorno_dias: number | null;
}

/** #RRGGBB válido — o resto é ignorado em silêncio, nunca aplicado. */
function corValida(cor?: string | null): string | null {
  return cor && /^#[0-9a-fA-F]{6}$/.test(cor.trim()) ? cor.trim() : null;
}

/**
 * Hex → "H S% L%", que é o formato dos tokens do produto.
 *
 * O canal aplica a cor da empresa sobrescrevendo `--primary` no seu próprio
 * contentor. Assim tudo o que já usa o token — botões, focos, realces —
 * acompanha, sem uma única classe condicional espalhada pelas telas.
 */
export function hexParaHsl(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) return null;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useCanalDenuncia(slug: string | undefined) {
  const [empresa, setEmpresa] = useState<EmpresaPublica | null>(null);
  const [config, setConfig] = useState<ConfigCanal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!slug) {
        setCarregando(false);
        return;
      }
      try {
        const emp = await fetchEmpresaPublicaPorSlug(slug);
        if (!vivo) return;
        setEmpresa(emp);
        if (!emp) return;

        const { data } = await supabase
          .from('denuncias_configuracoes_publicas')
          .select('*')
          .eq('empresa_id', emp.id)
          .maybeSingle();
        if (vivo) setConfig((data as ConfigCanal) ?? null);
      } catch (erro) {
        logger.error('Erro ao carregar o canal', { module: 'useCanalDenuncia', error: String(erro) });
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [slug]);

  /*
    O estilo que a empresa escolheu, pronto a pôr no contentor do canal.
    Sem cor definida devolve `undefined` e tudo cai no roxo da plataforma —
    um `undefined` é melhor do que reescrever o token com o mesmo valor.
  */
  const estiloDaMarca = useMemo(() => {
    const cor = corValida(config?.cor_destaque);
    const hsl = cor ? hexParaHsl(cor) : null;
    return hsl ? ({ ['--primary' as string]: hsl } as React.CSSProperties) : undefined;
  }, [config?.cor_destaque]);

  /** Como o canal se apresenta: nome escolhido, ou a razão social. */
  const nomeDoCanal = config?.nome_exibicao?.trim() || empresa?.nome || '';

  return { empresa, config, carregando, estiloDaMarca, nomeDoCanal };
}
