import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";

/**
 * Écran « Rapport journalier »
 *
 * Motif d'interface : Circuit d'approbation
 *
 * Squelette posé par la tâche T-005. Le contenu réel est développé
 * au sprint qui porte la fonctionnalité correspondante.
 */
export default function Page() {
  const t = useTranslations("squelettes");

  return (
    <EnTetePage titre={t("rapportJournalier.titre")} description={t("aConstruire", { motif: t("rapportJournalier.motif") })} />
  );
}
