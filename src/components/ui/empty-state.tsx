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
  variant?: "default" | "illustrated";
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, variant = "default", ...props }, ref) => {
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

          <h3 className="relative mb-2 text-lg font-semibold text-foreground tracking-tight">
            {title}
          </h3>
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
        <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
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
