import { useTranslations } from "next-intl";

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
    <main className="p-8">
      <h1 className="text-h1">{t("rapportJournalier.titre")}</h1>
      <p className="text-body mt-2">{t("aConstruire", { motif: t("rapportJournalier.motif") })}</p>
    </main>
  );
}
