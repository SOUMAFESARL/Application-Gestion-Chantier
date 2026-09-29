import { Zap } from "lucide-react";
import type { ReactNode } from "react";

import { Carte } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Le cadre d'une carte de forfait — le même pour la page de tarifs de
 * l'espace entreprise et pour l'écran qui la paramètre au back-office.
 *
 * Partagé plutôt que recopié : l'agent qui règle un prix doit le voir dans la
 * carte même que le client lira, et un changement de style ne doit pas avoir
 * à être fait deux fois.
 *
 * Le forfait mis en avant a un cadre dégradé dont le bandeau haut porte
 * l'étiquette, et qui déborde des cartes voisines par le haut (`lg:-mt-9`) —
 * la grille qui les pose compense par un `lg:pt-9`.
 */
export function CadreForfait({
  populaire,
  libellePopulaire,
  children,
}: {
  populaire: boolean;
  libellePopulaire: string;
  children: ReactNode;
}) {
  const contenu = (
    <Carte
      plate
      className={cn(
        "flex flex-1 flex-col gap-5 border-0 p-6 md:p-6",
        populaire ? "rounded-xl bg-neutral-0" : "bg-primary-50",
      )}
    >
      {children}
    </Carte>
  );

  if (!populaire) return contenu;

  return (
    <div className="flex flex-col rounded-2xl bg-linear-to-b from-primary-600 via-primary-500 to-primary-300 px-1 pb-1 shadow-lg shadow-primary-500/30 lg:-mt-9">
      <p className="flex h-8 items-center justify-center gap-1.5 text-xs font-medium text-neutral-0">
        <Zap size={12} className="fill-current" aria-hidden="true" />
        {libellePopulaire}
      </p>
      {contenu}
    </div>
  );
}

/** Le sélecteur mensuel / annuel posé au-dessus des cartes. */
export function BasculePeriodicite<T extends string>({
  valeur,
  options,
  onChange,
}: {
  valeur: T;
  options: { valeur: T; libelle: ReactNode }[];
  onChange: (valeur: T) => void;
}) {
  // `border-0 bg-transparent` : sans preflight, un `button` garde le cadre
  // et le fond gris du navigateur.
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-neutral-100 p-1">
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-1.5 text-sm font-medium transition-colors",
            valeur === option.valeur
              ? "bg-neutral-0 text-neutral-900 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900",
          )}
          onClick={() => onChange(option.valeur)}
          aria-pressed={valeur === option.valeur}
        >
          {option.libelle}
        </button>
      ))}
    </div>
  );
}
