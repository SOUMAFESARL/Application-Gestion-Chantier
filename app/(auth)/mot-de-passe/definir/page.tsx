import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CarteAuth } from "@/components/layout/CarteAuth";

import { EcranDefinition } from "./EcranDefinition";

/**
 * Écran « Définir un mot de passe » — maquettes M2 et M6 écran 3.
 *
 * Motif d'interface : formulaire public sur jeton.
 *
 * Contrat : `contrat_reinitialisation_mot_de_passe_CCD_Digital.md` (§5, §5bis).
 *
 * **La sortie commune des trois portes** (contrat §1) : oubli, blocage après
 * cinq échecs et invitation aboutissent tous ici. Même jeton, même endpoint,
 * mêmes effets — seuls le titre et le bouton changent selon le motif.
 *
 * Le jeton voyage en **fragment** (`#jeton=…`), jamais en paramètre de
 * requête : un fragment n'atteint ni les journaux du serveur, ni l'en-tête
 * `Referer`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("motDePasseDefinir");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <>
      <CarteAuth>
        <EcranDefinition />
      </CarteAuth>
    </>
  );
}
