/**
 * Design system — composants de la charte graphique.
 *
 * Point d'entrée unique : les écrans importent depuis « @/components/ui »,
 * jamais depuis un fichier de composant directement. Cela permet de
 * réorganiser les fichiers sans toucher aux 19 écrans.
 */

export { Alerte } from "./Alerte";
export type { TypeAlerte } from "./Alerte";

export { Badge } from "./Badge";
export type { VarianteBadge } from "./Badge";

export { Bouton } from "./Bouton";
export type { TailleBouton, VarianteBouton } from "./Bouton";

export { Carte } from "./Carte";

export { Champ } from "./Champ";

export { EtatChargement, EtatErreur, EtatVide } from "./Etats";

export { Modale } from "./Modale";

export { Pagination } from "./pagination";

export { Tableau } from "./Tableau";
export type { Colonne } from "./Tableau";
