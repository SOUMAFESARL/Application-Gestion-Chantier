import { useTranslations } from "next-intl";

export default function StocksPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("stocks.titre")}</h1>
      <p>{t("aConstruire", { motif: t("stocks.motif") })}</p>
    </main>
  );
}
