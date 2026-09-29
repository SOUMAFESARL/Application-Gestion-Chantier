import { ListeProjets } from "./ListeProjets";

/**
 * Écran « Liste des projets »
 *
 * Motif d'interface : Liste filtrable
 *
 * La page ne porte que le gabarit : le tableau lit les chantiers côté
 * navigateur (React Query), donc tout ce qui dépend de la réponse vit dans
 * `ListeProjets`.
 *
 * **Ni `<main>`, ni gouttière, ni largeur centrée ici.** `app/(app)/layout.tsx`
 * pose la seule marge de l'écran : un second `padding` les additionnait (32 px
 * de chaque côté sur téléphone), et une largeur `mx-auto` propre à chaque page
 * décalait le titre d'un écran à l'autre.
 */
export default function Page() {
  return <ListeProjets />;
}
