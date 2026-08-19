import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { useLanguage } from "@/contexts/LanguageContext"
import { IconChevron, IconMore } from '@/components/icons';

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
  secondaryActions,
  children,
  ...props
}: PageHeaderProps) {
  const { t } = useLanguage()
  const hasSecondary = !!secondaryActions && secondaryActions.length > 0

  return (
    <div className={cn("space-y-3", className)} {...props}>
      {/* Breadcrumbs (opcional — o cabeçalho global já mostra as migalhas) */}
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
                    <IconChevron className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Main header content */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="truncate text-2xl sm:text-3xl font-bold tracking-tight" title={title}>{title}</h1>
            {badge && (
              <Badge variant={badge.variant} className="text-xs shrink-0">
                {badge.label}
              </Badge>
            )}
          </div>
          {description && (
            <p className="truncate text-sm text-muted-foreground" title={description}>
              {description}
            </p>
          )}
        </div>
        {(actions || hasSecondary) && (
          <div className="flex items-center gap-2 shrink-0">
            {hasSecondary && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t("layout.moreActions")} title={t("layout.moreActions")}>
                    <IconMore className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {secondaryActions!.map((action, i) => (
                    <React.Fragment key={`${action.label}-${i}`}>
                      {action.separatorBefore && i > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem disabled={action.disabled} onClick={action.onClick}>
                        {action.icon && <span className="mr-2 inline-flex">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {actions}
          </div>
        )}
      </div>

      {/* Additional content */}
      {children}
    </div>
  )
}
