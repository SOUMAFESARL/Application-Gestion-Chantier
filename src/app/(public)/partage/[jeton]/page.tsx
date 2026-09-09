import { useTranslations } from "next-intl";

import styles from "./page.module.css";

/**
 * Écran « Document partagé »
 *
 * Motif d'interface : Consultation externe
 *
 * Squelette posé par la tâche T-005. Le contenu réel est développé
 * au sprint qui porte la fonctionnalité correspondante.
 */
export default function Page() {
  const t = useTranslations("squelettes");

  return (
    <main className={styles.page}>
      <h1>{t("documentPartage.titre")}</h1>
      <p>{t("aConstruire", { motif: t("documentPartage.motif") })}</p>
    </main>
  );
}
