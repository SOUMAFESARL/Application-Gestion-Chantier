import { useTranslations } from "next-intl";

export default function PlanningPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("planning.titre")}</h1>
      <p>{t("aConstruire", { motif: t("planning.motif") })}</p>
    </main>
  );
}
