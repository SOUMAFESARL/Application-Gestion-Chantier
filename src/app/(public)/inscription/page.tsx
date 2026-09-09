import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CarteAuth } from "@/components/layout/CarteAuth";

import { FormulaireInscription } from "./FormulaireInscription";

/**
 * Écran « Inscription d'une entreprise » — maquette M8, écrans 1, 2 et 7.
 *
 * Motif d'interface : formulaire public.
 *
 * Contrat : `contrat_inscription_CCD_Digital.md` (T-021).
 * Provisionnement : `provisioning_multi_tenant_CCD_Digital.md` (T-020).
 *
 * **L'écran 5 de M8 n'existe plus.** Il affichait « Cet email est déjà
 * utilisé » — une réponse qui, sur un formulaire public sans
 * authentification, publie la liste des clients de l'éditeur. Le serveur
 * répond `202` dans les cinq branches du §2.4, et c'est l'email reçu qui
 * porte la vérité.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inscription");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <>
      <CarteAuth>
        <FormulaireInscription />
      </CarteAuth>
    </>
  );
}
