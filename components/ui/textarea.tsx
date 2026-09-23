import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Primitive `textarea` de shadcn (`npx shadcn@latest add textarea`).
 *
 * Mêmes écarts que `input.tsx` : rembourrage horizontal et fond pris aux
 * jetons `--input-*` de la charte, `text-base` à toutes les largeurs. La
 * hauteur minimale est celle de trois lignes, et le champ grandit avec son
 * contenu (`field-sizing-content`) au lieu d'afficher un ascenseur.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full min-w-0 resize-y rounded-md border border-input bg-card px-[var(--input-padding-x)] py-3 font-[inherit] text-base text-neutral-900 transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
