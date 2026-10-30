import { OngletDecoupage } from "./OngletDecoupage";

/**
 * Onglet « Découpage » de la fiche projet.
 *
 * Tant que l'arbre n'existe pas (`decoupageCree` faux), le tableau de démarrage ; ensuite, l'arbre
 * et ses gestes.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletDecoupage projetId={id} />;
}
