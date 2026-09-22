import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CadreAuthDouble } from "@/components/layout/CadreAuthDouble";
import { Card, CardContent } from "@/components/ui/card";

import { FormulaireOubli } from "./FormulaireOubli";

/**
 * Écran « Mot de passe oublié » — maquette M6, écrans 1 et 2.
 *
 * Motif d'interface : formulaire public, sur le même cadre à deux panneaux
 * que la connexion et l'inscription (plan de refonte, lot 7).
 *
 * Contrat : `contrat_reinitialisation_mot_de_passe_CCD_Digital.md` (§3).
 * Parcours : workflow T2 du Socle Commun §8.
 *
 * **Première des trois portes du même couloir** (contrat §1) : l'oubli, le
 * blocage après cinq échecs et l'invitation mènent tous à `/mot-de-passe/definir`.
 * Elles ne diffèrent que par leur déclencheur et par le texte de l'email.
 *
 * Le titre change selon l'état du formulaire (saisie, email envoyé, erreur) :
 * il est donc rendu par `FormulaireOubli`, pas ici — même raison que
 * l'inscription (`(public)/inscription/page.tsx`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("motDePasseOublie");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <CadreAuthDouble>
      <Card className="overflow-hidden py-0 shadow-md">
        <CardContent className="px-6 py-8 sm:px-8">
          <FormulaireOubli />
        </CardContent>
      </Card>
    </CadreAuthDouble>
  );
}
