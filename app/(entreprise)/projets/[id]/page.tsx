import { FicheProjet } from "./FicheProjet";

/**
 * Écran « Fiche projet »
 *
 * Motif d'interface : Fiche détail avec sous-objets
 *
 * L'identification saisie à la création, puis ce qui se fixe depuis la
 * fiche : l'équipe d'encadrement (le DG désigne le chef de projet), le
 * planning et le budget (le chef de projet les définit) — et ce que le
 * chantier en a fait depuis.
 * La page ne porte que le gabarit : la lecture vit dans `FicheProjet`.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheProjet projetId={id} />;
}
