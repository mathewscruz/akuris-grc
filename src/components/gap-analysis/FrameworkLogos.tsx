import { FrameworkBadge } from "@/components/frameworks/FrameworkBadge";

interface FrameworkLogoProps {
  nome: string;
  /** `tipo_framework` — reserva para frameworks próprios do cliente. */
  tipo?: string | null;
  className?: string;
}

/**
 * Compat wrapper kept for existing call sites.
 * Delegates to the unified FrameworkBadge (typographic acronym + Akuris tone).
 *
 * Size is inferred from the className — most callers pass an explicit h-/w-
 * utility, which we forward via className. The badge itself centers its content.
 */
export const FrameworkLogo: React.FC<FrameworkLogoProps> = ({ nome, tipo, className = "h-10 w-10" }) => {
  // Heuristic: pick a size token based on className hints
  const isXl = /h-2[0-9]|h-14|h-16|h-\[10[0-9]px\]/.test(className);
  const isLarge = /h-1[2-9]/.test(className);
  const isSmall = /h-[5-7]|h-8/.test(className);
  const size = isXl ? "xl" : isLarge ? "lg" : isSmall ? "sm" : "md";

  return <FrameworkBadge name={nome} tipo={tipo} size={size as "sm" | "md" | "lg" | "xl"} className={className} />;
};
