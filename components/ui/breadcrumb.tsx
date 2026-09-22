import * as React from "react"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"
import { ChevronRight } from "lucide-react"

/**
 * Primitive `breadcrumb` de shadcn, posée par `npx shadcn@latest add breadcrumb`.
 *
 * Écarts au fichier généré :
 *
 * 1. L'import de `cn` pointe vers `@/lib/utils` (même raison que `popover.tsx`).
 * 2. **`list-none` sur la liste** — `globals.css` n'importe pas le preflight de
 *    Tailwind tant que les CSS Modules cohabitent, l'`ol` garde donc son
 *    `list-style: decimal`. `BreadcrumbItem` y échappait (`inline-flex` se
 *    blockifie en `flex`, qui n'est plus un `list-item`), mais le séparateur,
 *    lui, ne pose aucun `display` : il restait le seul `list-item` de la liste
 *    et affichait son marqueur, soit un « 1. » planté au milieu du fil.
 *
 * `src/components/layout/FilAriane.tsx` est le composant métier qui utilise ces
 * briques — lui seul connaît la route et les libellés.
 */
function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex list-none flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
}
