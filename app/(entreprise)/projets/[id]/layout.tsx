import type { ReactNode } from "react";

import { CadreFicheProjet } from "./CadreFicheProjet";

/**
 * Le gabarit de la fiche d'un projet : l'en-tête et les onglets portés par l'URL (décision P5),
 * autour de l'onglet ouvert — la synthèse, le découpage, l'avancement, les équipes, les avenants.
 */
export default async function LayoutFicheProjet({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CadreFicheProjet projetId={id}>{children}</CadreFicheProjet>;
}
