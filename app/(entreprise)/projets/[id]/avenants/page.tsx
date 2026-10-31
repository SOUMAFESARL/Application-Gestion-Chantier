import { OngletAvenantsProjet } from "./OngletAvenantsProjet";

/** Onglet « Avenants » de la fiche projet (décision P9). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletAvenantsProjet projetId={id} />;
}
