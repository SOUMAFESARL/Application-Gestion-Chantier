import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TableauDeBordDirection } from "./TableauDeBordDirection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tableauDeBord");
  return { title: t("titre") };
}

/**
 * Le tableau de bord de l'espace entreprise — vue du Directeur Général
 * (docs/PLAN_INTERFACES_DG.md §1).
 *
 * La page ne porte que le gabarit : les données sont lues côté navigateur
 * (React Query), donc tout ce qui dépend de la réponse vit dans
 * `TableauDeBordDirection`.
 *
 * Il n'y a plus de jeu de secours ici. L'ancienne page affichait trois
 * chantiers inventés dès que l'API échouait, présentés comme réels ; une
 * panne s'affiche désormais comme une panne.
 */
export default function Page() {
  return <TableauDeBordDirection />;
}
