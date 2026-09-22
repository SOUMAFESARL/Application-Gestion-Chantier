import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Primitive `button` de shadcn, posée par `npx shadcn@latest add button`.
 *
 * Deux écarts au fichier généré, tous deux voulus (plan de refonte, lot 2) :
 *
 * 1. **Aucune couleur en dur** — chaque variante s'appuie sur un alias
 *    (`bg-primary`, `bg-accent`, `bg-background`…) déclaré dans `tokens.css`
 *    et exposé par `globals.css`, règle 4 du plan de refonte.
 * 2. **`bg-transparent border-0` dans la base** — `globals.css` n'importe pas
 *    le preflight de Tailwind tant que les CSS Modules cohabitent ; sans ces
 *    deux classes, les variantes `ghost` et `link` hériteraient du fond gris
 *    et de la bordure que le navigateur donne à un `button`.
 * 3. **Les hauteurs viennent des jetons de la charte** (`--button-height-*`)
 *    et non de l'échelle de shadcn : 48 px en `lg` est la cible tactile du
 *    Socle §8, pas une valeur d'esthétique.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center gap-2 rounded-md border-0 bg-transparent text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--button-height-md)] px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--button-height-sm)] gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-[var(--button-height-lg)] rounded-md px-[var(--button-padding-x)] text-base has-[>svg]:px-4",
        icon: "size-[var(--button-height-md)]",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[var(--button-height-sm)]",
        "icon-lg": "size-[var(--button-height-lg)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
