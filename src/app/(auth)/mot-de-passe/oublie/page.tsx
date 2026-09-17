import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CarteAuth } from "@/components/layout/CarteAuth";

import { FormulaireOubli } from "./FormulaireOubli";
import styles from "./page.module.css";

/**
 * Écran « Mot de passe oublié » — maquette M6, écrans 1 et 2.
 *
 * Motif d'interface : formulaire public.
 *
 * Contrat : `contrat_reinitialisation_mot_de_passe_CCD_Digital.md` (§3).
 * Parcours : workflow T2 du Socle Commun §8.
 *
 * **Première des trois portes du même couloir** (contrat §1) : l'oubli, le
 * blocage après cinq échecs et l'invitation mènent tous à `/mot-de-passe/definir`.
 * Elles ne diffèrent que par leur déclencheur et par le texte de l'email.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("motDePasseOublie");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <CarteAuth>
      <Suspense fallback={<div className={styles.attente} aria-hidden="true" />}>
        <FormulaireOubli />
      </Suspense>
    </CarteAuth>
  );
}
