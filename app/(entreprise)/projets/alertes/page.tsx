import { ListeAlertes } from "./ListeAlertes";

/**
 * Écran « Alertes de retard »
 *
 * Motif d'interface : Liste filtrable avec détail latéral
 *
 * La page ne porte que le gabarit : la liste lit les alertes côté navigateur
 * (React Query), donc tout ce qui dépend de la réponse vit dans `ListeAlertes`.
 * Ni `<main>`, ni gouttière, ni largeur centrée ici — `app/(entreprise)/layout.tsx`
 * pose la seule marge de l'écran.
 */
export default function Page() {
  return <ListeAlertes />;
}
