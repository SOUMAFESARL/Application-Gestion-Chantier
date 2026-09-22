import { useTranslations } from "next-intl";

/**
 * Écran « Liste des projets »
 *
 * Motif d'interface : Liste filtrable
 *
 * Squelette posé par la tâche T-005. Le contenu réel est développé
 * au sprint qui porte la fonctionnalité correspondante.
 */
export default function Page() {
  const t = useTranslations("squelettes");

  return (
    <main className="p-8">
      <h1 className="text-h1">{t("listeDesProjets.titre")}</h1>
      <p className="text-body mt-2">{t("aConstruire", { motif: t("listeDesProjets.motif") })}</p>
    </main>
  );
}
