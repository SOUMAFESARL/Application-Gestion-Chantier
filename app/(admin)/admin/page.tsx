import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { VueEnsemble } from "./VueEnsemble";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("administration.meta");
  return { title: t("titre") };
}

export default function PageAdministration() {
  return <VueEnsemble />;
}
