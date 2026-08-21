/**
 * Para onde levar quem entra — quando o painel pode não existir.
 *
 * Enquanto todo o cliente tinha a suíte inteira, `/dashboard` era resposta
 * suficiente: o produto começava sempre no mesmo sítio. A venda avulsa do
 * canal de denúncia quebra isso. Um cliente que comprou só o canal não tem
 * painel de GRC — e mandá-lo para lá dá-lhe, logo a seguir ao pagamento, um
 * cartão de "acesso negado" como primeira tela do produto.
 *
 * Aqui devolve-se a primeira rota que a pessoa consegue mesmo abrir, na ordem
 * em que os módulos aparecem no menu. Se nada estiver acessível, resta
 * `/configuracoes`, que o plano nunca esconde: pelo menos há por onde
 * configurar o que se comprou, ou pedir ajuda.
 */
import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

/** Mesma ordem do menu: quem chega vê o topo da sua própria navegação. */
const ROTAS: Array<{ modulo: string; rota: string }> = [
  { modulo: 'dashboard', rota: '/dashboard' },
  { modulo: 'denuncia', rota: '/denuncia' },
  { modulo: 'planos-acao', rota: '/planos-acao' },
  { modulo: 'projetos', rota: '/projetos' },
  { modulo: 'riscos', rota: '/riscos' },
  { modulo: 'gap-analysis', rota: '/gap-analysis' },
  { modulo: 'ativos', rota: '/ativos' },
  { modulo: 'contratos', rota: '/contratos' },
  { modulo: 'documentos', rota: '/documentos' },
  { modulo: 'dados', rota: '/dados' },
  { modulo: 'incidentes', rota: '/incidentes' },
  { modulo: 'continuidade', rota: '/continuidade' },
  { modulo: 'relatorios', rota: '/relatorios' },
];

const ULTIMO_RECURSO = '/configuracoes';

export function useRotaInicial(): { rota: string; carregando: boolean } {
  const { canAccess, loading } = usePermissions();

  const rota = useMemo(() => {
    const encontrada = ROTAS.find((r) => canAccess(r.modulo));
    return encontrada?.rota ?? ULTIMO_RECURSO;
  }, [canAccess]);

  return { rota, carregando: loading };
}
