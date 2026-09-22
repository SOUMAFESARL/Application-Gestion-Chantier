import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type VarianteBadge =
  | "primaire"
  | "secondaire"
  | "succes"
  | "erreur"
  | "avertissement"
  | "neutre";

interface Props {
  variante?: VarianteBadge;
  children: ReactNode;
  icone?: ReactNode;
}

/**
 * Les variantes semantiques tirent leur fond de la couleur du texte, a 12 %
 * — charte §7.7. `bg-succes/12` est exactement le `color-mix` de l'ancienne
 * feuille, ecrit dans la syntaxe d'opacite de Tailwind.
 */
const VARIANTES: Record<VarianteBadge, string> = {
  primaire: "bg-primary-100 text-primary-800",
  secondaire: "bg-secondary-100 text-secondary-700",
  neutre: "bg-neutral-100 text-neutral-600",
  succes: "bg-succes/12 text-succes",
  erreur: "bg-erreur/12 text-erreur",
  avertissement: "bg-avertissement/12 text-avertissement",
};

/**
 * Badge — charte §7.7.
 *
 * Sert surtout à afficher un statut : `EN_RETARD`, `APPROUVE`, `BLOQUANT`.
 * Le libellé est **toujours** écrit en toutes lettres à côté de la couleur
 * (charte §8.4) : un chantier « en retard » doit se lire, pas se deviner
 * à la teinte d'une pastille.
 */
export function Badge({ variante = "neutre", children, icone }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-relaxed font-semibold whitespace-nowrap",
        VARIANTES[variante],
      )}
    >
      {icone}
      {children}
    </span>
  );
}
