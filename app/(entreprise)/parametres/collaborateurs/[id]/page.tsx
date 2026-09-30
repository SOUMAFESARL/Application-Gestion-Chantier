import { FicheCollaborateur } from "./FicheCollaborateur";

/**
 * Écran « Fiche collaborateur »
 *
 * Motif d'interface : Fiche détail avec sous-objets
 *
 * L'identité du compte et les chantiers qui lui sont attribués, rangés par
 * statut. La page ne porte que le gabarit : la lecture vit dans
 * `FicheCollaborateur`.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FicheCollaborateur collaborateurId={id} />;
}
