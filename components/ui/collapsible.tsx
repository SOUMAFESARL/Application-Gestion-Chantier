"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

/**
 * Primitive `collapsible` de shadcn (`npx shadcn@latest add collapsible`).
 *
 * Aucun écart au fichier généré : elle ne pose aucun style. L'état ouvert se
 * lit sur `data-state="open"`, que les descendants ciblent par un groupe
 * nommé (`group/collapsible` sur la racine, puis
 * `group-data-[state=open]/collapsible:…`) — c'est ainsi que le chevron d'un
 * sous-menu pivote sans état React à lui.
 */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
