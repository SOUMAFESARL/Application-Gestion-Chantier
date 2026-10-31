import { OngletAvancementProjet } from "./OngletAvancementProjet";

/** Onglet « Avancement » de la fiche projet : courbe en S et fin estimée (lot 12). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletAvancementProjet projetId={id} />;
}
