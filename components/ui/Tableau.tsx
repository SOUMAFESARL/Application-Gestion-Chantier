import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Pagination } from "./pagination";

export interface Colonne<T> {
  cle: string;
  entete: string;
  rendu: (ligne: T) => ReactNode;
  /** Les montants et les quantités s'alignent à droite (charte §9.1). */
  aligneADroite?: boolean;
  /** Colonne masquée sous 768 px — le mobile ne montre que l'essentiel. */
  secondaire?: boolean;
  /** Colonne figée à gauche lors du défilement horizontal. */
  figee?: boolean;
  /** Largeur minimale CSS garantie (ex: "200px"). */
  largeurMinimale?: string;
}

interface Props<T> {
  colonnes: Colonne<T>[];
  lignes: T[];
  cleLigne: (ligne: T) => string;
  onLigneCliquee?: (ligne: T) => void;
  legende?: string;
  className?: string;
  sansBordure?: boolean;
  /** Nombre de lignes par page. Sans elle, le tableau reste sans pagination. */
  tailleDePage?: number;
}

/** Charte §8.1 : les donnees critiques — les montants — en semibold minimum. */
const DROITE = "text-right font-semibold tabular-nums";

/**
 * Une colonne figee doit porter son propre fond, opaque, sinon le contenu qui
 * defile dessous se lit au travers. Il lui faut donc rejouer l'alternance des
 * lignes et le survol, que le `tr` porte pour toutes les autres cellules —
 * d'ou `group-*`, le `tr` etant le groupe.
 */
const FIGEE_CELLULE = "sticky left-0 z-2";
const FIGEE_ENTETE = "sticky left-0 z-4 bg-neutral-50";
const FIGEE_CORPS = [
  "bg-neutral-0 shadow-[2px_0_5px_-1px_rgb(0_0_0/0.06)]",
  "group-[&:nth-child(even)]:bg-neutral-50",
].join(" ");

/**
 * Tableau — charte §7.8.
 *
 * Le tableau déborde horizontalement dans son propre conteneur plutôt que
 * de faire défiler la page entière : sur un téléphone, une page qui glisse
 * latéralement est inutilisable.
 */
export function Tableau<T>({
  colonnes,
  lignes,
  cleLigne,
  onLigneCliquee,
  legende,
  className,
  sansBordure,
  tailleDePage,
}: Props<T>) {
  const [pageIndex, setPageIndex] = useState(0);

  const nombrePages = tailleDePage ? Math.max(1, Math.ceil(lignes.length / tailleDePage)) : 1;
  // Derive plutot que corriger par effet : une recherche qui fait fondre le
  // resultat de dix pages a trois ne doit jamais laisser la page courante
  // pointer dans le vide.
  const pageIndexEffectif = Math.min(pageIndex, nombrePages - 1);
  const lignesAffichees = tailleDePage
    ? lignes.slice(pageIndexEffectif * tailleDePage, pageIndexEffectif * tailleDePage + tailleDePage)
    : lignes;

  const tableau = (
    <table className="w-full border-collapse text-sm">
      {legende && (
        <caption className="px-4 py-3 text-left font-semibold text-neutral-800">
          {legende}
        </caption>
      )}
      <thead>
        <tr>
          {colonnes.map((colonne) => (
            <th
              key={colonne.cle}
              scope="col"
              style={colonne.largeurMinimale ? { minWidth: colonne.largeurMinimale } : undefined}
              className={cn(
                "border-b border-neutral-200 bg-neutral-50 p-4 text-left font-semibold whitespace-nowrap text-neutral-800",
                colonne.aligneADroite && DROITE,
                colonne.secondaire && "hidden md:table-cell",
                colonne.figee && [FIGEE_CELLULE, FIGEE_ENTETE],
              )}
            >
              {colonne.entete}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignesAffichees.map((ligne) => (
          <tr
            key={cleLigne(ligne)}
            onClick={onLigneCliquee ? () => onLigneCliquee(ligne) : undefined}
            className={cn(
              "group even:bg-neutral-50",
              onLigneCliquee && "cursor-pointer hover:bg-primary-50",
            )}
          >
            {colonnes.map((colonne) => (
              <td
                key={colonne.cle}
                style={colonne.largeurMinimale ? { minWidth: colonne.largeurMinimale } : undefined}
                className={cn(
                  "border-b border-neutral-200 p-4 text-neutral-700 group-last:border-b-0",
                  colonne.aligneADroite && DROITE,
                  colonne.secondaire && "hidden md:table-cell",
                  colonne.figee && [FIGEE_CELLULE, FIGEE_CORPS],
                  // Le `!` tranche l'egalite de specificite avec
                  // l'alternance ci-dessus : au survol, la colonne figee
                  // doit suivre sa ligne, quel que soit son rang.
                  colonne.figee && onLigneCliquee && "group-hover:bg-primary-50!",
                )}
              >
                {colonne.rendu(ligne)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!tailleDePage) {
    return (
      <div
        className={cn(
          "overflow-x-auto rounded-md border border-neutral-200",
          sansBordure && "rounded-none border-0",
          className,
        )}
      >
        {tableau}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-neutral-200",
        sansBordure && "rounded-none border-0",
        className,
      )}
    >
      <div className="overflow-x-auto">{tableau}</div>
      <div className={cn("px-4 py-3", !sansBordure && "border-t border-neutral-200")}>
        <Pagination
          pageIndex={pageIndexEffectif}
          nombrePages={nombrePages}
          peutPagePrecedente={pageIndexEffectif > 0}
          peutPageSuivante={pageIndexEffectif < nombrePages - 1}
          allerPremierePage={() => setPageIndex(0)}
          allerPagePrecedente={() => setPageIndex(pageIndexEffectif - 1)}
          allerPageSuivante={() => setPageIndex(pageIndexEffectif + 1)}
          allerDernierePage={() => setPageIndex(nombrePages - 1)}
        />
      </div>
    </div>
  );
}
