/**
 * O início de quem entra, quando o painel pode não fazer parte do produto.
 *
 * `/dashboard` era o destino de tudo — login, checkout, clique no logótipo — e
 * isso funcionava enquanto todo o cliente tinha a suíte inteira. Com o canal
 * de denúncia vendido à parte deixa de funcionar: quem comprou só o canal não
 * tem painel de GRC e receberia, como primeira tela depois de pagar, um cartão
 * a dizer "acesso negado".
 *
 * Em vez de mudar todos os pontos de entrada, o desvio fica no destino.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useRotaInicial } from '@/hooks/useRotaInicial';
import { AkurisPulse } from '@/components/ui/AkurisPulse';

export function InicioDoCliente({ children }: { children: ReactNode }) {
  const { canAccess, loading } = usePermissions();
  const { rota } = useRotaInicial();

  /* Sem esperar, o primeiro render acha que nada está acessível e desvia para
     configurações antes de as permissões chegarem. */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AkurisPulse size={32} />
      </div>
    );
  }

  if (!canAccess('dashboard') && rota !== '/dashboard') {
    return <Navigate to={rota} replace />;
  }

  return <>{children}</>;
}
