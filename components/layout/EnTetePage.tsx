import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EnTetePageProps {
  titre: ReactNode;
  description?: ReactNode;
  /** Actions de l'écran, calées à droite du titre. */
  actions?: ReactNode;
  className?: string;
}

/**
 * L'en-tête commun à tous les écrans de l'espace entreprise : titre,
 * sous-titre, actions.
 *
 * Chaque écran posait le sien — `text-2xl`, `text-h2`, `text-[26px]`,
 * `text-lg` — et sa propre largeur centrée (`max-w-5xl`, `max-w-[1200px]`,
 * `max-w-[1400px]`…) : le titre ne tombait jamais au même endroit ni à la
 * même taille d'un écran à l'autre. La marge vient désormais **seulement** de
 * la gouttière de `app/(app)/layout.tsx`, et la typographie seulement d'ici.
 *
 * L'action reste à droite à toutes les largeurs : le titre se resserre
 * (`min-w-0`) et les boutons passent à la ligne entre eux plutôt que de
 * renvoyer le bloc entier sous le titre.
 */
export function EnTetePage({ titre, description, actions, className }: EnTetePageProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-h2 font-bold text-neutral-900">{titre}</h1>
        {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>}
    </header>
  );
}
