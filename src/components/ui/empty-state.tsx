import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AkurisMarkPattern } from "@/components/identity/AkurisMarkPattern";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  /**
   * Variante visual:
   * - "default": versão clean atual (compatível com usos existentes).
   * - "illustrated": com Mark Pattern Akuris + moldura violeta no ícone.
   */
  variant?: "default" | "illustrated" | "quickstart";
  /** Atalhos de início (variante quickstart). */
  shortcuts?: Array<{ icon?: React.ReactNode; label: string; description?: string; onClick: () => void }>;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, variant = "default", shortcuts, ...props }, ref) => {
    const atalhos = shortcuts ?? (action ? [{ icon, label: action.label, description, onClick: action.onClick }] : []);
    if (variant === "quickstart" || (variant === "default" && shortcuts?.length)) {
      return (
        <div
          ref={ref}
          className={cn("flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-10 text-center sm:px-8", className)}
          {...props}
        >
          {icon && <div className="mb-3 text-primary [&_svg]:h-8 [&_svg]:w-8">{icon}</div>}
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
          {atalhos.length > 0 && (
            <div className={cn("mt-6 grid w-full max-w-3xl gap-3", atalhos.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "max-w-xs")}>
              {atalhos.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-5 text-center transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {a.icon && <span className="text-primary [&_svg]:h-6 [&_svg]:w-6">{a.icon}</span>}
                  <span className="text-sm font-semibold text-foreground">{a.label}</span>
                  {a.description && <span className="text-xs text-muted-foreground">{a.description}</span>}
                  <span aria-hidden="true" className="mt-1 text-primary transition-transform group-hover:translate-x-0.5">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (variant === "illustrated") {
      return (
        <div
          ref={ref}
          className={cn(
            "relative flex flex-col items-center justify-center py-16 px-4 text-center overflow-hidden rounded-lg border border-border/60 bg-gradient-to-b from-surface-1 to-surface-2",
            className
          )}
          {...props}
        >
          {/* Akuris Mark Pattern de fundo */}
          <AkurisMarkPattern opacity={0.05} />

          {/* Moldura do ícone — anel duplo violeta */}
          {icon && (
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-lg bg-primary/5 blur-2xl" aria-hidden="true" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-background text-primary">
                  {icon}
                </div>
              </div>
            </div>
          )}

          <h2 className="relative mb-2 text-lg font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="relative mb-6 max-w-md text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
          {action && (
            <Button
              className="relative"
              variant={action.variant || "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mb-4 text-muted-foreground">
            {icon}
          </div>
        )}
        <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {action && (
          <Button
            variant={action.variant || "default"}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

export { EmptyState };
