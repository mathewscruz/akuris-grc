import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

interface BreadcrumbItemType {
  label: string
  href?: string
}

/** Ação secundária recolhida no menu "..." ao lado da ação primária. */
export interface SecondaryAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  disabled?: boolean
  /** Insere um divisor antes deste item. */
  separatorBefore?: boolean
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItemType[]
  badge?: {
    label: string
    variant?: "default" | "secondary" | "destructive" | "success" | "warning" | "info"
  }
  /** Ação primária — sempre uma só, botão roxo cheio, canto superior direito. */
  actions?: React.ReactNode
  /** Ações secundárias (Importar, Exportar, Templates…) no menu "...". */
  secondaryActions?: SecondaryAction[]
  children?: React.ReactNode
}


export function PageHeader({
  className,
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                      {item.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="font-medium">
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Main header content */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-1 sm:space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            {badge && (
              <Badge variant={badge.variant} className="text-xs">
                {badge.label}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {/* Additional content */}
      {children}
    </div>
  )
}

export default PageHeader