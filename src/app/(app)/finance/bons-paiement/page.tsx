import { useTranslations } from "next-intl";

import styles from "./page.module.css";

/**
 * Écran « Bons de paiement »
 *
 * Motif d'interface : Circuit d'approbation
 *
 * Squelette posé par la tâche T-005. Le contenu réel est développé
 * au sprint qui porte la fonctionnalité correspondante.
 */
export default function Page() {
  const t = useTranslations("squelettes");

  return (
    <main className={styles.page}>
      <h1>{t("bonsDePaiement.titre")}</h1>
      <p>{t("aConstruire", { motif: t("bonsDePaiement.motif") })}</p>
    </main>
  );
}
