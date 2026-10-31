import { OngletEquipesProjet } from "../OngletEquipesProjet";

/**
 * Le lien d'une équipe : l'onglet Équipes, son tiroir ouvert. Garde vivants les liens déjà
 * partagés vers l'ancienne fiche d'équipe.
 */
export default async function Page({ params }: { params: Promise<{ id: string; equipeId: string }> }) {
  const { id, equipeId } = await params;
  return <OngletEquipesProjet projetId={id} equipeId={equipeId} />;
}
