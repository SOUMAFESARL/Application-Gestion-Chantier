"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Separator as SeparatorPrimitive } from "radix-ui"

/**
 * Primitive `separator` de shadcn, posée par `npx shadcn@latest add separator`.
 *
 * Un seul écart au fichier généré : l'import de `cn` pointe vers
 * `@/lib/utils` (voir `popover.tsx`). La couleur est celle de `--border`,
 * donc le filet suit la charte comme les bordures des champs.
 *
 * `decorative` est vrai par défaut : le filet ne fait que rythmer la mise en
 * page, un lecteur d'écran n'a pas à l'annoncer. Le passer à `false` quand il
 * sépare réellement deux groupes de contenu.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
