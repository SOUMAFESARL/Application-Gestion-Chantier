import { LotsActivites } from "./LotsActivites";

/**
 * Écran « Lots & activités »
 *
 * Motif d'interface : Liste filtrable
 *
 * Les lots saisis à l'étape 2 de la création d'un projet, et les activités
 * qu'on y rattache ensuite. La page ne porte que le gabarit : tout ce qui
 * dépend des données vit dans `LotsActivites`, lu côté navigateur.
 */
export default function Page() {
  return <LotsActivites />;
}
