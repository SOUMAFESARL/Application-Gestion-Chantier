import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BandeauSimulation } from "@/components/layout/BandeauSimulation";

import { Wizard } from "./Wizard";

import styles from "./page.module.css";

/**
 * Écran « Configuration initiale » — maquette M9.
 *
 * Motif d'interface : assistant en trois étapes.
 *
 * Parcours : `parcours_wizard_onboarding_CCD_Digital.md` (T-022).
 * Persistance : `contrat_wizard_CCD_Digital.md` (T-024).
 *
 * **La configuration appartient à l'entreprise, pas à la personne** : un
 * second administrateur qui se connecte après le premier ne la recommence
 * pas, il la reprend là où elle en est. C'est un état unique par schéma.
 *
 * Réservé à `AD`. La garde de route reste un **confort** : le serveur vérifie
 * les droits à chaque requête, et une route cachée n'est pas une route
 * protégée.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("configuration");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    <>
      <BandeauSimulation />
      <main className={styles.page}>
        <Wizard />
      </main>
    </>
  );
}
