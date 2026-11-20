import { OngletConfigurationProjet } from "./OngletConfigurationProjet";

/** Onglet « Configuration » de la fiche projet : informations complémentaires et nature public/privé (T1, T6). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OngletConfigurationProjet projetId={id} />;
}
