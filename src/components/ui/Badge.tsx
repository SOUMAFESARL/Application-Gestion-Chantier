import type { ReactNode } from "react";

import styles from "./Badge.module.css";

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
 * Badge — charte §7.7.
 *
 * Sert surtout à afficher un statut : `EN_RETARD`, `APPROUVE`, `BLOQUANT`.
 * Le libellé est **toujours** écrit en toutes lettres à côté de la couleur
 * (charte §8.4) : un chantier « en retard » doit se lire, pas se deviner
 * à la teinte d'une pastille.
 */
export function Badge({ variante = "neutre", children, icone }: Props) {
  return (
    <span className={`${styles.badge} ${styles[variante]}`}>
      {icone}
      {children}
    </span>
  );
}
