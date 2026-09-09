import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CarteAuth } from "@/components/layout/CarteAuth";

import { EcranActivation } from "./EcranActivation";

/**
 * Écran « Activation d'un compte » — maquette M8, écrans 3, 4 et 6.
 *
 * Motif d'interface : formulaire public sur jeton.
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
  return (
    <>
      <CarteAuth>
        <EcranActivation />
      </CarteAuth>
    </>
  );
}
