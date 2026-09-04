import { ModuleLoadingSkeleton } from './module-loading-skeleton';

/**
 * Reserva a estrutura da página durante consultas de dados. Isso reduz o
 * salto de layout e permite ao usuário antecipar onde filtros, KPIs e tabela
 * aparecerão, enquanto o pulse continua reservado às ações locais.
 */
export function PageSkeleton() {
  return <ModuleLoadingSkeleton />;
}
