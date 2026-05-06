import { FrameworkBadge } from "@/components/frameworks/FrameworkBadge";

interface FrameworkLogoProps {
  nome: string;
  className?: string;
}

/**
 * Compat wrapper kept for existing call sites.
 * Delegates to the unified FrameworkBadge (typographic acronym + Akuris tone).
 *
 * Size is inferred from the className — most callers pass an explicit h-/w-
 * utility, which we forward via className. The badge itself centers its content.
 */
export const FrameworkLogo: React.FC<FrameworkLogoProps> = ({ nome, className = "h-10 w-10" }) => {
  // Heuristic: pick a size token based on className hints
  const isLarge = /h-1[2-9]|h-2[0-9]/.test(className);
  const isSmall = /h-[5-7]|h-8/.test(className);
  const size = isLarge ? "lg" : isSmall ? "sm" : "md";

  return <FrameworkBadge name={nome} size={size as "sm" | "md" | "lg"} className={className} />;
};
