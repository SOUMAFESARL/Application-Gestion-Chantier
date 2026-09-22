import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranActivation } from "./EcranActivation";

/**
 * Écran « Activation d'un compte » — maquette M8, écrans 3, 4 et 6.
 *
 * Motif d'interface : formulaire public sur jeton, deux panneaux — la marque
 * sur un dégradé de couleur à gauche, le formulaire à droite (plan de
 * refonte, lot 7). Pas de photo de chantier ici : le panneau de gauche
 * accueille un message de bienvenue qui nomme l'entreprise créée, connu
 * seulement une fois le jeton vérifié côté client — c'est `EcranActivation`
 * qui possède tout l'écran, panneau compris, pour porter ce contenu dynamique
 * jusque-là.
 *
 * C'est ici que le provisionnement se déclenche : le schéma PostgreSQL, ses
 * migrations, l'administrateur, le domaine et l'abonnement d'essai n'existent
 * qu'à partir du moment où quelqu'un suit le lien reçu par email
 * (T-020 §1.1). Tant qu'il n'a pas été suivi, **aucune donnée n'a été
 * enregistrée** — c'est ce que promet l'écran du lien expiré.
 *
 * Le jeton voyage en **fragment** (`#jeton=…`), jamais en paramètre de
 * requête : un fragment n'atteint ni les journaux Nginx, ni l'en-tête
 * `Referer` (R-84).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activation");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return <EcranActivation />;
}
