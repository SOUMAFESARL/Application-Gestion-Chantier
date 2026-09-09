import type { ReactNode } from "react";

import styles from "./Tableau.module.css";

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
}

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
}: Props<T>) {
  return (
    <div
      className={[
        styles.conteneur,
        sansBordure ? styles.sansBordure : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <table className={styles.tableau}>
        {legende && <caption className={styles.legende}>{legende}</caption>}
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                style={colonne.largeurMinimale ? { minWidth: colonne.largeurMinimale } : undefined}
                className={[
                  colonne.aligneADroite ? styles.droite : "",
                  colonne.secondaire ? styles.secondaire : "",
                  colonne.figee ? styles.figee : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {colonne.entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr
              key={cleLigne(ligne)}
              onClick={onLigneCliquee ? () => onLigneCliquee(ligne) : undefined}
              className={onLigneCliquee ? styles.cliquable : undefined}
            >
              {colonnes.map((colonne) => (
                <td
                  key={colonne.cle}
                  style={colonne.largeurMinimale ? { minWidth: colonne.largeurMinimale } : undefined}
                  className={[
                    colonne.aligneADroite ? styles.droite : "",
                    colonne.secondaire ? styles.secondaire : "",
                    colonne.figee ? styles.figee : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {colonne.rendu(ligne)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
