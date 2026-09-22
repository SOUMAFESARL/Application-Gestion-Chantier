import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CarteAuth } from "@/components/layout/CarteAuth";

import { EcranInvitation } from "./EcranInvitation";

/**
 * Écran « Invitation d'un collaborateur » — maquette M2, T-015 et T-017.
 *
 * Le collaborateur active son compte en définissant son mot de passe et son identité
 * depuis le lien sécurisé reçu par email avec fragment (#jeton=...).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invitation");
  return {
    title: t("titre", { entreprise: "CCD Digital" }),
    description: t("validite"),
  };
}

export default function Page() {
  return (
    <CarteAuth>
      <EcranInvitation />
    </CarteAuth>
  );
}
