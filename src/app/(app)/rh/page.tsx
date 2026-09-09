import { useTranslations } from "next-intl";

export default function RhPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("rh.titre")}</h1>
      <p>{t("aConstruire", { motif: t("rh.motif") })}</p>
    </main>
  );
}
