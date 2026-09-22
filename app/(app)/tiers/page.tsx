import { useTranslations } from "next-intl";

export default function TiersPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("tiers.titre")}</h1>
      <p>{t("aConstruire", { motif: t("tiers.motif") })}</p>
    </main>
  );
}
