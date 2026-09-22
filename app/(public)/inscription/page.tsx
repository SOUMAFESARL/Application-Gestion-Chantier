import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CadreAuthDouble } from "@/components/layout/CadreAuthDouble";
import { Card, CardContent } from "@/components/ui/card";

import { FormulaireInscription } from "./FormulaireInscription";

/**
 * Écran « Inscription d'une entreprise » — maquette M8, écrans 1, 2 et 7.
 *
 * Motif d'interface : formulaire public, sur le même cadre à deux panneaux
 * que la connexion (plan de refonte, lot 7) — la marque sur la photo de
 * chantier à gauche, le formulaire à droite.
 *
 * Contrat : `contrat_inscription_CCD_Digital.md` (T-021).
 * Provisionnement : `provisioning_multi_tenant_CCD_Digital.md` (T-020).
 *
 * **L'écran 5 de M8 n'existe plus.** Il affichait « Cet email est déjà
 * utilisé » — une réponse qui, sur un formulaire public sans
 * authentification, publie la liste des clients de l'éditeur. Le serveur
 * répond `202` dans les cinq branches du §2.4, et c'est l'email reçu qui
 * porte la vérité.
 *
 * Le titre change selon l'état du formulaire (saisie, email envoyé, erreur) :
 * il est donc rendu par `FormulaireInscription`, pas ici — contrairement à
 * l'écran de connexion, dont le titre reste fixe quel que soit l'état.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inscription");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <CadreAuthDouble>
      <Card className="overflow-hidden py-0 shadow-md">
        <CardContent className="px-6 py-8 sm:px-8">
          <FormulaireInscription />
        </CardContent>
      </Card>
    </CadreAuthDouble>
  );
}
