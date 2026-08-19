import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const TabsValueContext = React.createContext<string | undefined>(undefined)

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, className, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue)
  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = React.useCallback((next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }, [value, onValueChange])

  return (
    <TabsValueContext.Provider value={currentValue}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        /**
         * O ritmo vertical é de TODO o bloco de abas, não só da barra.
         *
         * Cinco páginas põem uma faixa de indicadores entre a barra e o
         * painel. Com a folga só na barra, a faixa respirava em cima e
         * encostava no painel em baixo — trocou-se um encosto por outro.
         * `space-y` aqui separa cada par de irmãos, seja qual for a ordem em
         * que a página os monte, e colapsa com a margem da barra em vez de
         * somar, portanto a distância é a mesma em todos os pares.
         */
        className={cn("space-y-4", className)}
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
      /* A folga por baixo da barra de abas vive AQUI, e não em cada painel.
         Estava no `TabsContent`, o que só dava espaço a quem fosse um painel:
         uma faixa de indicadores posta entre a barra e o painel — cinco
         páginas fazem isso — encostava na barra, porque não herdava margem
         nenhuma. Pondo a margem na barra, tudo o que vier a seguir respira,
         seja painel, cartão ou filtro. */
      "mb-4",
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
>(({ className, value, forceMount, ...props }, ref) => {
  const activeValue = React.useContext(TabsValueContext)
  const [visited, setVisited] = React.useState(activeValue === value)

  React.useEffect(() => {
    if (activeValue === value) setVisited(true)
  }, [activeValue, value])

  return (
    <TabsPrimitive.Content
      ref={ref}
      value={value}
      forceMount={forceMount || visited || undefined}
      className={cn(
        /* Sem margem própria: a folga vem do `mb-4` da `TabsList`. Ter as duas
           somava 30px, e cada página corrigia isso à sua maneira — havia
           `mt-0`, `mt-3`, `mt-5` e `mt-6` escritos à mão em 48 sítios. */
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "data-[state=inactive]:hidden",
        // Sem transição de opacidade: evita o clarão sobre conteúdos pesados.
        "data-[state=active]:animate-tab-enter motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
})
TabsContent.displayName = TabsPrimitive.Content.displayName


export { Tabs, TabsList, TabsTrigger, TabsContent }
