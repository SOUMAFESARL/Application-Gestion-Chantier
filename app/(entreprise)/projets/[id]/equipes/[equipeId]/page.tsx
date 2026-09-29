import { FicheEquipe } from "./FicheEquipe";

/**
 * Écran « Fiche équipe »
 *
 * Motif d'interface : Fiche détail
 *
 * Les membres d'une équipe de chantier et leur rôle : on y ajoute une
 * personne, on change son rôle, on la retire. On y arrive en cliquant une
 * carte de « Équipes et affectations ».
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; equipeId: string }>;
}) {
  const { id, equipeId } = await params;
  return <FicheEquipe projetId={id} equipeId={equipeId} />;
}
