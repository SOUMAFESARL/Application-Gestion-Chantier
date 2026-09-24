import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EcranInvitation } from "./EcranInvitation";

/**
 * Écran « Invitation d'un collaborateur » — maquette M2, T-015 et T-017.
 *
 * Le collaborateur active son compte en définissant son mot de passe depuis
 * le lien sécurisé reçu par email avec fragment (#jeton=...).
 *
 * Même motif que `/activation` : `EcranInvitation` possède tout l'écran,
 * panneau compris, puisque le nom de l'entreprise affiché à gauche n'est
 * connu qu'une fois le jeton vérifié côté client.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invitation");
  return {
    title: t("titre", { entreprise: "CCD Digital" }),
    description: t("validite"),
  };
}

export default function Page() {
  return <EcranInvitation />;
}
