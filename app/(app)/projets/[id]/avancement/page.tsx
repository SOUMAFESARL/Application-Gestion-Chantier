import { useTranslations } from "next-intl";

/**
 * Écran « Avancement du projet »
 *
 * Motif d'interface : Visualisation temporelle
 *
 * Squelette posé par la tâche T-005. Le contenu réel est développé
 * au sprint qui porte la fonctionnalité correspondante.
 */
export default function Page() {
  const t = useTranslations("squelettes");

  return (
    <main className="p-8">
      <h1 className="text-h1">{t("avancementDuProjet.titre")}</h1>
      <p className="text-body mt-2">{t("aConstruire", { motif: t("avancementDuProjet.motif") })}</p>
    </main>
  );
}
