import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Primitive `alert` de shadcn, posée par `npx shadcn@latest add alert`.
 *
 * Les deux variantes livrées (`default`, `destructive`) sont remplacées par
 * les **quatre tons sémantiques de la charte** — ce sont ceux que le produit
 * emploie déjà, et les seuls dont le couple fond/texte a été mesuré.
 *
 * La couleur ne porte jamais l'information seule (charte §8.4) : chaque
 * alerte écrit son titre en toutes lettres et le double d'une icône. C'est
 * l'appelant qui pose l'icône, mais le motif en grille ci-dessous lui
 * réserve sa colonne.
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        information:
          "border-information/20 bg-information-fond text-information *:data-[slot=alert-description]:text-information/90",
        succes:
          "border-succes/20 bg-succes-fond text-succes *:data-[slot=alert-description]:text-succes/90",
        avertissement:
          "border-avertissement/20 bg-avertissement-fond text-avertissement *:data-[slot=alert-description]:text-avertissement/90",
        erreur:
          "border-erreur/20 bg-erreur-fond text-erreur *:data-[slot=alert-description]:text-erreur/90",
      },
    },
    defaultVariants: {
      variant: "information",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
