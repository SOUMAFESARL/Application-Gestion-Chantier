import { FicheProjet } from "./FicheProjet";

/**
 * Écran « Fiche projet »
 *
 * Motif d'interface : Fiche détail avec sous-objets
 *
 * Tout ce que la création a saisi d'un projet — dates, budget, maîtrise
 * d'ouvrage et d'œuvre, équipe — et ce que le chantier en a fait depuis.
 * La page ne porte que le gabarit : la lecture vit dans `FicheProjet`.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheProjet projetId={id} />;
}
