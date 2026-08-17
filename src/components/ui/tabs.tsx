import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Contexto interno: expõe o valor da aba activa para que o TabsContent possa
 * manter as abas já visitadas montadas (evita o "piscar" ao alternar, pois o
 * conteúdo não é desmontado nem refaz as queries).
 */
const TabsValueContext = React.createContext<string | undefined>(undefined)

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue)
  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next)
      onValueChange?.(next)
    },
    [value, onValueChange],
  )

  return (
    <TabsValueContext.Provider value={currentValue}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsValueContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName


/**
 * TabsList — padrão único de abas do Akuris: régua com linha de base e
 * indicador (underline) roxo na aba ativa. Funciona em light e dark.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex w-full items-center gap-6 overflow-x-auto border-b border-border text-muted-foreground",
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative inline-flex min-w-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap",
      "border-b-2 border-transparent bg-transparent px-1 py-3 -mb-px text-sm font-medium leading-tight",
      "ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground hover:text-foreground hover:border-border",
      "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold",
      "dark:data-[state=active]:text-foreground [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0 dark:data-[state=active]:[&_svg]:text-primary",
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName


const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      // Transição de entrada padrão ao alternar abas dentro de um módulo.
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=active]:animate-tab-enter motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
