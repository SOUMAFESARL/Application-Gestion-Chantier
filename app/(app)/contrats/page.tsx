import { useTranslations } from "next-intl";

export default function ContratsPage() {
  const t = useTranslations("squelettes");

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1>{t("contrats.titre")}</h1>
      <p>{t("aConstruire", { motif: t("contrats.motif") })}</p>
    </main>
  );
}
