import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EnTetePage } from "@/components/layout/EnTetePage";

import { SectionsParametres } from "./SectionsParametres";

/**
 * Écran « Paramètres » : l'entrée des réglages de l'entreprise — collaborateurs,
 * rôles, listes, calendrier, configuration. Chaque section reste un écran à part.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageParametres");
  return { title: t("titre"), description: t("metaDescription") };
}

export default async function Page() {
  const t = await getTranslations("pageParametres");

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("description")} />
      <SectionsParametres />
    </div>
  );
}
