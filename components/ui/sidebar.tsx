"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Slot } from "radix-ui"
import { ChevronRight, PanelLeftIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Primitive `sidebar` de shadcn, posée par `npx shadcn@latest add sidebar`.
 *
 * Écrite à la main : le CLI n'a pas pu joindre le registre depuis cet
 * environnement (délai dépassé sur « Checking registry »). Le contenu suit
 * la version publique du composant, **réduite** aux briques que
 * `(app)/layout.tsx` utilise réellement (pas de `SidebarInput`, `SidebarMenuBadge`,
 * `SidebarMenuSkeleton` ni sous-menus — la nav de ce produit n'en a pas
 * besoin ; les ajouter sans appelant aurait été de l'abstraction prématurée).
 *
 * Écarts au comportement d'origine : `cn` importé de `@/lib/utils` ; état
 * replié persisté en cookie **et** `localStorage` retiré au profit du seul
 * cookie (pas de lecture serveur de toute façon dans ce gabarit) ; les deux
 * libellés d'accessibilité (bouton replier, tiroir mobile) passent par
 * `useTranslations("uiGenerique")` au lieu d'un texte en dur — seul le nom
 * du crochet de style change (`data-slot`, déjà la convention du projet,
 * remplace le `data-sidebar` de la version publique) ; l'item actif porte en
 * plus `shadow-sm` — sur `docs/interface.jpg` la ligne courante est une
 * pastille blanche posée sur la barre, et sans ombre elle se confondrait avec
 * le survol, qui utilise le même fond.
 *
 * `SidebarMenuButton` pose **explicitement** `text-sidebar-foreground`, là où
 * la version publique se contente d'hériter de `Sidebar`. Les items de nav
 * sont des `<a>` (`asChild` + `Link`), et `globals.css` colore tout `a` en
 * `primary-600` dans la couche `base` : une couleur posée sur l'élément
 * l'emporte sur l'héritage, toute la nav sortait donc en orange et
 * `--color-sidebar-foreground` ne servait à rien. L'utilitaire, lui, est en
 * couche `utilities` — il repasse devant.
 */

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }
      try {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${60 * 60 * 24 * 7}`
      } catch {
        // Cookies désactivés : l'état repliable retombe au défaut au
        // prochain chargement, un confort perdu, pas une fonctionnalité.
      }
    },
    [setOpenProp, open]
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "icon",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const t = useTranslations("uiGenerique")
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-slot="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            { "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("menuMobile")}</SheetTitle>
            <SheetDescription>{t("navigationMobile")}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* Espaceur qui pousse le contenu — le vrai panneau est fixed. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l border-sidebar-border",
          className
        )}
        {...props}
      >
        <div
          data-slot="sidebar-inner"
          className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const t = useTranslations("uiGenerique")
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-8", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">{t("basculerBarreLaterale")}</span>
    </Button>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        // `min-w-0` : sans lui, un tableau large (la matrice des rôles,
        // 12 modules) grandit cet item flex plutôt que de se faire contenir —
        // c'est tout le document qui défile alors horizontalement, barre
        // latérale comprise, au lieu du seul tableau via son `overflow-x-auto`.
        "relative flex w-full min-w-0 flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 border-b border-sidebar-border p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        // `scrollbar-width: thin` + une poignée dans le ton de la barre : par
        // défaut, l'ascenseur du navigateur pose une gouttière pleine largeur
        // qui mange la nav et ramène du gris système au milieu de la charte.
        // Deux propriétés standard, pas de `::-webkit-scrollbar` : Chromium
        // 121+, Firefox et Safari 18 les honorent tous.
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto [scrollbar-width:thin] [scrollbar-color:var(--color-sidebar-border)_transparent] group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      // `list-none` : sans le preflight de Tailwind (voir `globals.css`), l'`ul`
      // garde `list-style: disc` et `SidebarMenuItem`, qui ne pose aucun
      // `display`, reste un `list-item` — donc une puce par entrée de nav.
      className={cn("flex w-full min-w-0 list-none flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

// `border-0 bg-transparent` : même raison que dans `button.tsx` — le preflight
// de Tailwind n'est pas importé, un vrai `<button>` garde donc le cadre et le
// fond gris du navigateur. Les entrées de nav y échappaient (elles sont des
// `<a>` via `asChild`), mais pas la carte utilisateur du pied, qui est le seul
// `SidebarMenuButton` rendu en `<button>` : c'est de là que venait son contour.
// `no-underline` : sans lui, `globals.css` (`a:hover { text-decoration: underline }`,
// couche `base`) soulignait le libellé au survol — les entrées de nav sont des
// `<a>` (`asChild` + `Link`). L'utilitaire l'emporte car il est en couche
// `utilities`, qui passe toujours devant `base`.
// `data-[active=true]:bg-primary` : l'item actif se distingue par une pastille
// orange pleine (texte en `primary-foreground`, blanc), pas seulement par son
// texte — c'est le fond qui porte la couleur.
const SIDEBAR_MENU_BUTTON_BASE =
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md border-0 bg-transparent p-2 text-left text-sm text-sidebar-foreground no-underline outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-primary data-[active=true]:font-medium data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0"

const sidebarMenuButtonSizes = {
  default: "h-8 text-sm",
  lg: "h-12 group-data-[collapsible=icon]:p-0! text-sm",
}

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  size = "default",
  tooltip,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  size?: keyof typeof sidebarMenuButtonSizes
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
}) {
  const Comp = asChild ? Slot.Root : "button"
  const { isMobile, state } = useSidebar()

  // Flèche posée à droite de l'item actif — repère de sélection en plus de la
  // pastille orange, y compris replié en icônes où le libellé disparaît.
  const fleche = isActive ? (
    <ChevronRight aria-hidden="true" className="ml-auto group-data-[collapsible=icon]:hidden" />
  ) : null

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(SIDEBAR_MENU_BUTTON_BASE, sidebarMenuButtonSizes[size], className)}
      {...props}
    >
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
      {fleche}
    </Comp>
  )

  if (!tooltip) {
    return button
  }

  const tooltipProps: React.ComponentProps<typeof TooltipContent> =
    typeof tooltip === "string" ? { children: tooltip } : tooltip

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  )
}

/** Le délai avant fermeture : de quoi traverser l'espace entre l'entrée et le panneau. */
const DELAI_FERMETURE_SOUS_MENU = 150

/**
 * Le sous-menu d'une entrée de nav, en **panneau volant** à droite de la
 * barre — comme le sous-menu d'un `DropdownMenu` : il s'ouvre au survol de
 * l'entrée, reste ouvert tant que le pointeur est sur l'entrée ou sur le
 * panneau, et se referme en le quittant.
 *
 * Il fonctionne aussi replié en icônes : c'est même là qu'il sert le plus,
 * puisque les libellés n'y sont plus. Sur téléphone (barre en tiroir), il
 * n'y a pas de survol : les entrées s'affichent alors en liste sous l'entrée
 * parente, toujours atteignables.
 *
 * `declencheur` est le `SidebarMenuButton` de l'entrée ; `children`, des
 * `SidebarMenuSousMenuLien`.
 */
function SidebarMenuSousMenu({
  declencheur,
  libelle,
  children,
}: {
  declencheur: React.ReactNode
  /** Le nom du panneau, pour les lecteurs d'écran. */
  libelle: string
  children: React.ReactNode
}) {
  const { isMobile } = useSidebar()
  const [ouvert, setOuvert] = React.useState(false)
  const minuterie = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const annulerFermeture = React.useCallback(() => {
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = null
  }, [])

  const ouvrir = React.useCallback(() => {
    annulerFermeture()
    setOuvert(true)
  }, [annulerFermeture])

  const fermerBientot = React.useCallback(() => {
    annulerFermeture()
    minuterie.current = setTimeout(() => setOuvert(false), DELAI_FERMETURE_SOUS_MENU)
  }, [annulerFermeture])

  React.useEffect(() => annulerFermeture, [annulerFermeture])

  if (isMobile) {
    return (
      <SidebarMenuItem>
        {declencheur}
        <ul
          aria-label={libelle}
          className="mx-3.5 mt-1 flex min-w-0 list-none flex-col gap-1 border-0 border-l border-solid border-sidebar-border py-0.5 pl-2.5"
        >
          {children}
        </ul>
      </SidebarMenuItem>
    )
  }

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverAnchor asChild>
        <SidebarMenuItem
          onMouseEnter={ouvrir}
          onMouseLeave={fermerBientot}
          // Au clavier : la flèche droite ouvre le panneau, comme dans un menu.
          onKeyDown={(evenement) => {
            if (evenement.key === "ArrowRight") {
              evenement.preventDefault()
              ouvrir()
            }
          }}
        >
          {declencheur}
        </SidebarMenuItem>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        onMouseEnter={annulerFermeture}
        onMouseLeave={fermerBientot}
        // Le survol ne doit pas voler le focus à la page.
        onOpenAutoFocus={(evenement) => evenement.preventDefault()}
        className="w-auto min-w-48 p-1"
      >
        <ul aria-label={libelle} className="m-0 flex list-none flex-col gap-0.5 p-0">
          {children}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Une entrée du sous-menu — un lien (`asChild` + `Link`). */
function SidebarMenuSousMenuLien({
  isActive = false,
  className,
  children,
}: {
  isActive?: boolean
  className?: string
  children: React.ReactElement
}) {
  return (
    <li>
      <Slot.Root
        data-active={isActive}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-foreground no-underline outline-hidden select-none",
          "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
          "data-[active=true]:font-semibold data-[active=true]:text-primary",
          className
        )}
      >
        {children}
      </Slot.Root>
    </li>
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSousMenu,
  SidebarMenuSousMenuLien,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
