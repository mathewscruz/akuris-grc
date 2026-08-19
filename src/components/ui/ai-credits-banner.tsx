import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconWarning } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAiCredits } from '@/hooks/useAiCredits';

/**
 * Banner global de créditos de IA esgotados.
 * Renderiza somente quando o saldo zerou; respeita Light/Dark.
 * Para usuários comuns: mensagem orienta contato com o administrador.
 * Para super-admins: link direto para Configurações → Créditos de IA.
 */
export function AiCreditsExhaustedBanner() {
  const navigate = useNavigate();
  const { esgotado, isSuperAdmin, loading, franquia } = useAiCredits();

  if (loading || !esgotado || franquia === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'relative border-b border-destructive/30 bg-destructive/10 text-destructive',
        'px-4 py-2.5 flex items-center gap-3 flex-wrap',
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/15 shrink-0">
        <IconWarning className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-[240px]">
        <p className="text-xs font-semibold leading-tight">
          Créditos de IA esgotados
        </p>
        <p className="text-micro opacity-90 leading-tight mt-0.5">
          {isSuperAdmin
            ? 'Os assistentes inteligentes estão indisponíveis até que mais créditos sejam liberados.'
            : 'Para continuar usando os assistentes inteligentes, entre em contato com o administrador da sua conta.'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-micro border-destructive/40 text-destructive hover:bg-destructive/15"
          onClick={() =>
            navigate(isSuperAdmin ? '/configuracoes?tab=creditos-ia' : '/configuracoes?tab=assinatura')
          }
        >
          {isSuperAdmin ? 'Gerenciar créditos' : 'Ver meu plano'}
        </Button>
      </div>
    </div>
  );
}
