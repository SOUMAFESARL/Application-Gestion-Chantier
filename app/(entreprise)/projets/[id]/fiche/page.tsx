import { ApercuFicheProjetPage } from "../ApercuFicheProjetPage";

/**
 * Prévisualisation pleine page de la fiche projet (`/projets/[id]/fiche`),
 * conçue pour le Maître d'ouvrage, le DG et le Chef de projet.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApercuFicheProjetPage projetId={id} />;
}
