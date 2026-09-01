import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * O recorte que veio do painel, lido do endereço.
 *
 * ## O defeito
 *
 * Os cartões de KPI abrem uma gaveta com o recorte pedido — «Ativos críticos»,
 * «Contas expiradas», «Licenças a vencer» — e mostram **cinco** linhas, porque
 * é o que lá cabe. Por baixo há um botão «Ver todos». Esse botão navegava para
 * a rota nua do módulo.
 *
 * Medido: «10 Alta ou crítica» → gaveta com 5 activos críticos → «Ver todos» →
 * `/ativos` com as 12 linhas todas e o filtro de criticidade em «Todas». O
 * único caminho para ver os outros cinco levava a lado nenhum, e sem aviso: a
 * lista aparece, parece a resposta, e não é.
 *
 * ## O mecanismo
 *
 * Não é filtro novo em doze páginas — é o recorte que a gaveta JÁ calculou,
 * passado adiante: `?ids=a,b,c&de=<chave>`. O padrão não é invenção nova; a
 * matriz de riscos já mandava `?ids=` para a tabela de riscos desde sempre.
 * Aqui fica num sítio só, dentro da `DataTable`, e serve todos os módulos.
 *
 * `de` é o que distingue os dois: sem ele, `ids` continua a ser tratado pela
 * página que o inventou (a matriz de riscos tem chip próprio, e limpá-lo
 * também desmarca a célula da matriz). Com ele, é a tabela que trata.
 */

/** Acima disto o endereço fica absurdo e não vale a pena: cai na rota nua. */
export const MAX_IDS_NO_ENDERECO = 300;

export interface RecorteDaUrl {
  /** `null` quando não há recorte — e aí a tabela mostra tudo, como sempre. */
  ids: ReadonlySet<string> | null;
  /** Chave do recorte, para dizer ao utilizador de onde veio. */
  de: string | null;
  /** Tira o recorte do endereço, sem mexer no resto dos parâmetros. */
  limpar: () => void;
}

export function useRecorteDaUrl(): RecorteDaUrl {
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = searchParams.get('ids');
  const de = searchParams.get('de');

  const conjunto = React.useMemo(() => {
    if (!ids || !de) return null;
    const lista = ids.split(',').map((s) => s.trim()).filter(Boolean);
    return lista.length > 0 ? new Set(lista) : null;
  }, [ids, de]);

  const limpar = React.useCallback(() => {
    const proximos = new URLSearchParams(searchParams);
    proximos.delete('ids');
    proximos.delete('de');
    setSearchParams(proximos, { replace: true });
  }, [searchParams, setSearchParams]);

  return { ids: conjunto, de: conjunto ? de : null, limpar };
}
