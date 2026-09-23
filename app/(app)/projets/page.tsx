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
 * **Ni `<main>` ni gouttière ici.** `app/(app)/layout.tsx` en pose déjà un,
 * avec son propre `padding` : un second les additionnait, ce qui faisait
 * 32 px de marge de chaque côté sur téléphone — la moitié de la largeur
 * utile d'un tableau à sept colonnes.
 */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ListeProjets />
    </div>
  );
}
