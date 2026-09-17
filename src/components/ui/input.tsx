import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Primitive `input` de shadcn, posée par `npx shadcn@latest add input`.
 *
 * Trois écarts au fichier généré (mêmes raisons que `button.tsx`) :
 * les variantes `dark:` sont retirées (arbitrage A3) ; la hauteur, le
 * rembourrage et le rayon viennent des jetons `--input-*` de la charte
 * plutôt que de l'échelle de shadcn — 48 px est la cible tactile du
 * Socle §8 ; et `text-base` est conservé à toutes les largeurs, là où
 * shadcn redescend à 14 px au-delà de `md`. Sur un téléphone de chantier,
 * en plein soleil, le plancher de lisibilité ne dépend pas de la largeur
 * de l'écran.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[var(--input-height)] w-full min-w-0 rounded-md border border-input bg-card px-[var(--input-padding-x)] py-1 text-base text-neutral-900 transition-[color,box-shadow,border-color] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
