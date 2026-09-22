import { useTranslations } from "next-intl";

export default function QhsePage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("qhse.titre")}</h1>
      <p>{t("aConstruire", { motif: t("qhse.motif") })}</p>
    </main>
  );
}
