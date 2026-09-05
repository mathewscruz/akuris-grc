import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useMotionAllowed } from "@/lib/motion-preferences"

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
/**
 * Diz que há mais abas do lado que não cabe.
 *
 * A barra rola na horizontal mas esconde a barra de rolagem, de propósito
 * — fica limpa. O preço era a última aba aparecer cortada a meio da
 * palavra, sem nada a dizer que havia mais: medido no detalhe de um
 * controlo, «Planos de ação» tem 119 px e só 77 se viam. Quem lê isso
 * conclui que o rótulo está partido, não que a barra continua.
 *
 * Um esbatimento do lado que transborda resolve sem mexer no desenho: a
 * última aba deixa de acabar a direito e passa a desvanecer, que é como
 * uma lista diz «continua». Aparece só quando há mesmo mais para ver.
 */
function useTransbordo(alvo: React.RefObject<HTMLElement>) {
  const [lado, setLado] = React.useState<'nenhum' | 'inicio' | 'fim' | 'ambos'>('nenhum')

  React.useEffect(() => {
    const el = alvo.current
    if (!el) return

    const medir = () => {
      // 1 px de folga: larguras fracionárias davam falsos positivos.
      const antes = el.scrollLeft > 1
      const depois = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setLado(antes && depois ? 'ambos' : antes ? 'inicio' : depois ? 'fim' : 'nenhum')
    }

    medir()
    el.addEventListener('scroll', medir, { passive: true })

    // O tamanho muda com a janela; o CONTEÚDO muda quando uma contagem
    // passa de (9) a (10) ou uma aba aparece. As duas contam.
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    const mo = new MutationObserver(medir)
    mo.observe(el, { childList: true, subtree: true, characterData: true })

    return () => {
      el.removeEventListener('scroll', medir)
      ro.disconnect()
      mo.disconnect()
    }
  }, [alvo])

  return lado
}

const ESBATIMENTO: Record<string, string | undefined> = {
  nenhum: undefined,
  inicio: 'linear-gradient(to right, transparent, #000 2rem)',
  fim: 'linear-gradient(to right, #000 calc(100% - 2rem), transparent)',
  ambos: 'linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent)',
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { showIndicator?: boolean }
>(({ className, style, children, showIndicator = true, ...props }, ref) => {
  const { t } = useLanguage()
  const motionAllowed = useMotionAllowed()
  const interna = React.useRef<HTMLDivElement>(null)
  const lado = useTransbordo(interna)
  const horizontal = showIndicator && !className?.includes("flex-col")
  const mascara = horizontal ? ESBATIMENTO[lado] : undefined
  const activeValue = React.useContext(TabsValueContext)
  const [indicator, setIndicator] = React.useState({ left: 0, top: 0, width: 0, visible: false })

  /* Um único indicador desloca-se entre as abas. Antes cada aba desenhava a
     própria borda: uma desaparecia e outra aparecia, sem explicar a mudança
     de contexto. A posição é medida porque os rótulos são traduzidos, têm larguras diferentes. */
  React.useLayoutEffect(() => {
    const list = interna.current
    if (!list) return

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      if (!active) {
        setIndicator((current) => ({ ...current, visible: false }))
        return
      }
      const next = {
        left: active.offsetLeft,
        top: active.offsetTop + active.offsetHeight - 2,
        width: active.offsetWidth,
        visible: true,
      }
      setIndicator((current) =>
        current.left === next.left && current.top === next.top && current.width === next.width && current.visible
          ? current
          : next
      )
    }

    measure()
    const frame = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).forEach((tab) => ro.observe(tab))
    const mo = new MutationObserver(measure)
    mo.observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-state'] })

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      mo.disconnect()
    }
  }, [activeValue])

  const scrollTabs = (direction: number) => {
    const list = interna.current
    if (list) list.scrollBy({ left: direction * Math.max(160, list.clientWidth * 0.65), behavior: motionAllowed ? "smooth" : "instant" })
  }

  return (
  <div className="akuris-tabs-viewport relative min-w-0 max-w-full shrink-0 mb-4">
  <TabsPrimitive.List
    ref={(no) => {
      ;(interna as React.MutableRefObject<HTMLDivElement | null>).current = no as HTMLDivElement | null
      if (typeof ref === 'function') ref(no)
      else if (ref) (ref as React.MutableRefObject<unknown>).current = no
    }}
    data-transbordo={lado}
    data-scrollable={horizontal ? "true" : undefined}
    style={{ maskImage: mascara, WebkitMaskImage: mascara, ...style }}
    className={cn(
      "akuris-tabs-list relative flex w-full items-center gap-4 overflow-x-auto overflow-y-hidden border-b border-border text-muted-foreground",
      // Uma só linha, com rótulos integrais e controles explícitos de rolagem.
      "flex-nowrap gap-y-0",
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      /* A margem pertence ao viewport da barra, incluindo os botões de rolagem. */
      "mb-0",
      className,
    )}
    {...props}
  >
    {children}
    {showIndicator && (
      <span
        aria-hidden="true"
        className="akuris-tab-indicator"
        style={{
          width: indicator.width,
          opacity: indicator.visible ? 1 : 0,
          transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
        }}
      />
    )}
  </TabsPrimitive.List>
  {horizontal && (lado === "inicio" || lado === "ambos") && <button type="button" className="akuris-tabs-scroll left-0" aria-label={t("experience.tabsPrevious")} onClick={() => scrollTabs(-1)}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>}
  {horizontal && (lado === "fim" || lado === "ambos") && <button type="button" className="akuris-tabs-scroll right-0" aria-label={t("experience.tabsNext")} onClick={() => scrollTabs(1)}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>}
  </div>
  )
})
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
      "akuris-motion-micro ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-md",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground hover:text-foreground",
      "data-[state=active]:text-primary data-[state=active]:font-semibold",
      /* O glifo funciona como âncora de navegação: discreto em repouso,
         nítido e ligeiramente elevado na aba activa. Um único tratamento
         substitui as 221 variações locais sem transformar o ícone num botão. */
      "dark:data-[state=active]:text-foreground",
      "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground/80",
      "[&_svg]:transition-[color,transform,filter] [&_svg]:duration-200",
      "hover:[&_svg]:text-foreground data-[state=active]:[&_svg]:scale-105 data-[state=active]:[&_svg]:text-primary data-[state=active]:[&_svg]:drop-shadow-sm",
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
