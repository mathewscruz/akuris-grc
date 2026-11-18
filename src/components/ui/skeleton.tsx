import { cn } from "@/lib/utils";

/**
 * Skeleton — placeholder silencioso.
 *
 * Por decisão de design, o loader oficial e único do sistema é o
 * <AkurisPulse /> (via <LoadingOverlay />, <PageSkeleton /> ou
 * <ModuleLoadingSkeleton />). Como muitos módulos renderizam dezenas
 * de <Skeleton /> simultâneos para reservar espaço de linhas/cards,
 * exibir um pulse em cada um poluiria a tela.
 *
 * Este átomo agora:
 *   - Mantém a API e dimensões originais (não quebra layouts).
 *   - Não anima nem desenha barras cinza.
 *   - Reserva o espaço do conteúdo futuro de forma neutra.
 *
 * Para mostrar feedback visual de loading, prefira:
 *   - <LoadingOverlay /> em rotas/dialogs.
 *   - <ModuleLoadingSkeleton /> em páginas de módulo.
 *   - <AkurisPulse size={N} /> em seções/cards locais.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-transparent", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
