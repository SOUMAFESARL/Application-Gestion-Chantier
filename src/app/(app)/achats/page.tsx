import { useTranslations } from "next-intl";

export default function AchatsPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("achats.titre")}</h1>
      <p>{t("aConstruire", { motif: t("achats.motif") })}</p>
    </main>
  );
}
