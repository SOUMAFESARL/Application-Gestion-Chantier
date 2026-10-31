import { OngletEquipesProjet } from "./OngletEquipesProjet";

/** Onglet « Équipes » de la fiche projet (décision P12). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletEquipesProjet projetId={id} />;
}
